#!/usr/bin/env python3
"""Auto-layout generator for the architecture-diagram skill (local v1.2).

Removes the skill's manual portion: instead of hand-placing SVG
coordinates, the author writes a semantic ``diagram.json`` (components,
containers, connections — see SKILL.md for the schema) and this script
computes every pixel: column/row placement, container boxes, orthogonal
edge routing with lanes, legend placement, and viewBox sizing. Output is
the same self-contained HTML the upstream skill produces (design system,
export toolbar, summary cards all preserved).

Usage:
    python generate_diagram.py spec.json output.html
"""

import html
import json
import sys

# ── Design system (verbatim from SKILL.md) ───────────────────────────────────
STYLES = {
    'frontend': ('rgba(8, 51, 68, 0.4)', '#22d3ee'),
    'backend':  ('rgba(6, 78, 59, 0.4)', '#34d399'),
    'database': ('rgba(76, 29, 149, 0.4)', '#a78bfa'),
    'cloud':    ('rgba(120, 53, 15, 0.3)', '#fbbf24'),
    'security': ('rgba(136, 19, 55, 0.4)', '#fb7185'),
    'bus':      ('rgba(251, 146, 60, 0.3)', '#fb923c'),
    'external': ('rgba(30, 41, 59, 0.5)', '#94a3b8'),
}
EDGE_COLORS = {'data': '#a78bfa', 'email': '#fb923c', 'trigger': '#fbbf24',
               'http': '#22d3ee', 'plain': '#94a3b8'}
LEGEND_LABELS = {'frontend': 'Frontend', 'backend': 'Service / stage',
                 'database': 'Data store', 'cloud': 'Cloud service',
                 'security': 'Security', 'bus': 'Message / email',
                 'external': 'External system'}
MASK = '#0f172a'

# Layout constants
MARGIN = 40
COL_W = 210
GUTTER = 100
ROW_GAP = 46
GROUP_PAD = 16
GROUP_HEAD = 22
TOP = 70


def esc(t):
    return html.escape(str(t), quote=False)


class Node:
    def __init__(self, spec):
        self.id = spec['id']
        self.label = spec['label']
        self.subs = spec.get('sublabels', [])
        self.note = spec.get('note')
        self.type = spec.get('type', 'external')
        self.column = spec.get('column')
        self.group = spec.get('group')
        self.h = 40 + 15 * len(self.subs) + (15 if self.note else 0)
        self.x = self.y = 0
        self.w = COL_W

    @property
    def cy(self):
        return self.y + self.h / 2

    @property
    def right(self):
        return self.x + self.w

    @property
    def bottom(self):
        return self.y + self.h


def assign_columns(nodes, edges):
    """Longest-path rank for nodes without an explicit column hint."""
    ids = {n.id: n for n in nodes}
    unhinted = [n for n in nodes if n.column is None]
    if not unhinted:
        return
    rank = {n.id: 0 for n in nodes}
    for _ in range(len(nodes)):
        changed = False
        for e in edges:
            a, b = ids.get(e['from']), ids.get(e['to'])
            if a and b and rank[b.id] < rank[a.id] + 1:
                rank[b.id] = rank[a.id] + 1
                changed = True
        if not changed:
            break
    for n in unhinted:
        n.column = rank[n.id]


def layout(spec):
    nodes = [Node(n) for n in spec['nodes']]
    groups = {g['id']: dict(g) for g in spec.get('groups', [])}
    edges = spec.get('edges', [])
    assign_columns(nodes, edges)

    # Columns: strict JSON order, with group members pulled together at
    # the position their group FIRST appears (containers stay tight).
    ncols = max(n.column for n in nodes) + 1
    for c in range(ncols):
        col = sorted((n for n in nodes if n.column == c),
                     key=lambda n: spec_order(spec, n.id))
        # Contiguity is only forced for CONTAINER groups (service/security)
        # — region boundaries span freely, so their members keep spec order.
        def bucket_key(n):
            for g in group_chain(groups, n.group):
                if groups[g].get('type') != 'region':
                    return g
            return f'__solo_{n.id}'
        runs, run_index = [], {}
        for n in col:
            key = bucket_key(n)
            if key not in run_index:
                run_index[key] = len(runs)
                runs.append([])
            runs[run_index[key]].append(n)
        ordered = [n for run in runs for n in run]

        y = TOP
        prev_chain = []
        for n in ordered:
            chain = group_chain(groups, n.group)
            entering = [g for g in chain if g not in prev_chain]
            leaving = [g for g in prev_chain if g not in chain]
            y += len(leaving) * GROUP_PAD
            y += len(entering) * (GROUP_PAD + GROUP_HEAD)
            depth = len(chain)
            n.x = MARGIN + c * (COL_W + GUTTER) + depth * 10
            n.w = COL_W - depth * 20
            n.y = y
            y = n.bottom + ROW_GAP
            prev_chain = chain

    # Group boxes = bbox of members (nodes + child groups) + padding.
    boxes = {}
    def group_box(gid):
        if gid in boxes:
            return boxes[gid]
        members = [n for n in nodes if n.group == gid]
        child = [group_box(g2) for g2, g in groups.items()
                 if g.get('parent') == gid]
        xs = [m.x for m in members] + [b[0] for b in child]
        ys = [m.y for m in members] + [b[1] for b in child]
        x2 = [m.right for m in members] + [b[0] + b[2] for b in child]
        y2 = [m.bottom for m in members] + [b[1] + b[3] for b in child]
        box = (min(xs) - GROUP_PAD, min(ys) - GROUP_PAD - GROUP_HEAD,
               max(x2) - min(xs) + 2 * GROUP_PAD,
               max(y2) - min(ys) + 2 * GROUP_PAD + GROUP_HEAD)
        boxes[gid] = box
        return box
    for gid in groups:
        group_box(gid)
    return nodes, groups, boxes, edges


def spec_order(spec, nid):
    for i, n in enumerate(spec['nodes']):
        if n['id'] == nid:
            return i
    return 999


def group_chain(groups, gid):
    chain = []
    while gid:
        chain.append(gid)
        gid = groups.get(gid, {}).get('parent')
    return chain


def endpoint(nodes, groups, boxes, eid):
    """(cx, cy, left, right, top, bottom, column) for a node OR group id."""
    for n in nodes:
        if n.id == eid:
            return dict(cx=n.x + n.w / 2, cy=n.cy, left=n.x, right=n.right,
                        top=n.y, bottom=n.bottom, col=n.column)
    if eid in boxes:
        x, y, w, h = boxes[eid]
        member = next(n for n in nodes if group_chain(groups, n.group)
                      and eid in group_chain(groups, n.group))
        return dict(cx=x + w / 2, cy=y + h / 2, left=x, right=x + w,
                    top=y, bottom=y + h, col=member.column)
    raise KeyError(f'unknown edge endpoint: {eid}')


def route_edges(nodes, groups, boxes, edges):
    """Orthogonal routing: adjacent columns via gutter lanes; same-column
    via short verticals; multi-hop via a top or bottom channel."""
    out = []
    gutter_lanes = {}
    channel_lanes = {'top': 0, 'bottom': 0}
    content_bottom = max([n.bottom for n in nodes]
                        + [b[1] + b[3] for b in boxes.values()])
    mid_y = (TOP + content_bottom) / 2

    for e in edges:
        a = endpoint(nodes, groups, boxes, e['from'])
        b = endpoint(nodes, groups, boxes, e['to'])
        color = EDGE_COLORS.get(e.get('kind', 'plain'), '#94a3b8')
        dash = ' stroke-dasharray="5,5"' if e.get('dashed') else ''
        label = e.get('label')
        d = None
        lx = ly = None
        dc = b['col'] - a['col']

        if dc == 0:
            if a['bottom'] < b['top']:      # stacked: straight down
                x = a['cx']
                d = f"M {x} {a['bottom']} L {x} {b['top'] - 2}"
                lx, ly = x + 8, (a['bottom'] + b['top']) / 2
            else:                            # loop out the right side
                lane = gutter_lanes.setdefault(a['col'], 0) + 1
                gutter_lanes[a['col']] = lane
                gx = a['right'] + 14 + lane * 10
                d = (f"M {a['right']} {a['cy']} L {gx} {a['cy']} "
                     f"L {gx} {b['cy']} L {b['right'] + 2} {b['cy']}")
                lx, ly = gx + 6, (a['cy'] + b['cy']) / 2
        elif abs(dc) == 1:
            src_x = a['right'] if dc > 0 else a['left']
            dst_x = b['left'] - 2 if dc > 0 else b['right'] + 2
            gcol = min(a['col'], b['col'])
            lane = gutter_lanes.setdefault(('g', gcol), 0) + 1
            gutter_lanes[('g', gcol)] = lane
            gx = MARGIN + gcol * (COL_W + GUTTER) + COL_W + 20 + lane * 12
            d = (f"M {src_x} {a['cy']} L {gx} {a['cy']} "
                 f"L {gx} {b['cy']} L {dst_x} {b['cy']}")
            # Stagger labels per lane so parallel edges never overlap.
            lx = gx + 5
            ly = (min(a['cy'], b['cy']) + abs(a['cy'] - b['cy']) / 2
                  - 8 + (lane - 1) * 14)
        else:                                # multi-hop: over/under channel
            side = 'top' if (a['cy'] + b['cy']) / 2 < mid_y else 'bottom'
            channel_lanes[side] += 1
            lane = channel_lanes[side]
            cy = (TOP - 26 - lane * 14) if side == 'top' \
                else (content_bottom + 26 + lane * 14)
            sx, dx_ = a['cx'], b['cx']
            sy = a['top'] if side == 'top' else a['bottom']
            dy = (b['top'] - 2) if side == 'top' else (b['bottom'] + 2)
            d = f"M {sx} {sy} L {sx} {cy} L {dx_} {cy} L {dx_} {dy}"
            lx, ly = (sx + dx_) / 2, cy - 5 if side == 'top' else cy + 12
        out.append((d, color, dash, label, lx, ly))
    extremes = [ly for *_, ly in [(o[4], o[5]) for o in out]]
    return out, content_bottom, channel_lanes


def render_svg(spec, nodes, groups, boxes, edges):
    routed, content_bottom, ch = route_edges(nodes, groups, boxes, edges)
    svg = []

    # Group boundaries first (region fills are near-transparent).
    order = sorted(groups, key=lambda g: -len(group_chain(groups, g)))
    for gid in sorted(groups, key=lambda g: len(group_chain(groups,
                      groups[g].get('parent')))):
        g = groups[gid]
        x, y, w, h = boxes[gid]
        if g.get('type') == 'region':
            svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" '
                       f'fill="rgba(251, 191, 36, 0.05)" stroke="#fbbf24" '
                       f'stroke-width="1" stroke-dasharray="8,4"/>')
            svg.append(f'<text x="{x+12}" y="{y+16}" fill="#fbbf24" '
                       f'font-size="10" font-weight="600">{esc(g["label"])}</text>')
        elif g.get('type') == 'security':
            svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" '
                       f'fill="transparent" stroke="#fb7185" stroke-width="1" '
                       f'stroke-dasharray="4,4"/>')
            svg.append(f'<text x="{x+10}" y="{y+14}" fill="#fb7185" '
                       f'font-size="8">{esc(g["label"])}</text>')
        else:  # service container
            fill, stroke = STYLES['backend']
            svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" '
                       f'fill="{MASK}"/>')
            svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" '
                       f'fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
            svg.append(f'<text x="{x+w/2}" y="{y+16}" fill="white" '
                       f'font-size="11" font-weight="600" text-anchor="middle">'
                       f'{esc(g["label"])}</text>')

    # Edges behind nodes.
    for d, color, dash, label, lx, ly in routed:
        svg.append(f'<path d="{d}" fill="none" stroke="{color}" '
                   f'stroke-width="1.5"{dash} marker-end="url(#arrowhead)"/>')
        if label:
            svg.append(f'<text x="{lx}" y="{ly}" fill="{color}" '
                       f'font-size="8">{esc(label)}</text>')

    # Nodes (opaque mask + styled box, per the skill's masking rule).
    for n in nodes:
        fill, stroke = STYLES.get(n.type, STYLES['external'])
        svg.append(f'<rect x="{n.x}" y="{n.y}" width="{n.w}" height="{n.h}" '
                   f'rx="6" fill="{MASK}"/>')
        svg.append(f'<rect x="{n.x}" y="{n.y}" width="{n.w}" height="{n.h}" '
                   f'rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        cx = n.x + n.w / 2
        svg.append(f'<text x="{cx}" y="{n.y+18}" fill="white" font-size="11" '
                   f'font-weight="600" text-anchor="middle">{esc(n.label)}</text>')
        for i, s in enumerate(n.subs):
            svg.append(f'<text x="{cx}" y="{n.y+34+i*15}" fill="#94a3b8" '
                       f'font-size="8" text-anchor="middle">{esc(s)}</text>')
        if n.note:
            svg.append(f'<text x="{cx}" y="{n.y+n.h-8}" fill="{stroke}" '
                       f'font-size="7" text-anchor="middle">{esc(n.note)}</text>')

    # Legend below everything (incl. bottom channels).
    legend_y = content_bottom + 40 + ch['bottom'] * 14 + 20
    used = sorted({n.type for n in nodes} | {'security'}
                  if any(g.get('type') == 'security' for g in groups.values())
                  else {n.type for n in nodes})
    svg.append(f'<text x="{MARGIN}" y="{legend_y+8}" fill="white" '
               f'font-size="10" font-weight="600">Legend</text>')
    lx = MARGIN + 70
    for t in used:
        fill, stroke = STYLES[t]
        svg.append(f'<rect x="{lx}" y="{legend_y}" width="16" height="10" '
                   f'rx="2" fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
        svg.append(f'<text x="{lx+22}" y="{legend_y+8}" fill="#94a3b8" '
                   f'font-size="8">{LEGEND_LABELS[t]}</text>')
        lx += 30 + 7 * len(LEGEND_LABELS[t])

    ncols = max(n.column for n in nodes) + 1
    width = MARGIN * 2 + ncols * COL_W + (ncols - 1) * GUTTER
    height = legend_y + 30
    return '\n        '.join(svg), width, height


def render_html(spec):
    nodes, groups, boxes, edges = layout(spec)
    body, width, height = render_svg(spec, nodes, groups, boxes, edges)
    cards = ''
    for c in spec.get('cards', []):
        items = '\n          '.join(f'<li>• {esc(i)}</li>' for i in c['items'])
        cards += f'''
      <div class="card">
        <div class="card-header">
          <div class="card-dot {c.get("dot", "cyan")}"></div>
          <h3>{esc(c["title"])}</h3>
        </div>
        <ul>
          {items}
        </ul>
      </div>'''
    template = open(__file__.replace('generate_diagram.py', 'template.html'),
                    encoding='utf-8').read()
    # Splice into the upstream template: title/subtitle/svg/cards/footer.
    out = template.replace('[PROJECT NAME] Architecture Diagram',
                           f'{spec["title"]} Architecture Diagram')
    out = out.replace('[PROJECT NAME] Architecture', esc(spec['title']))
    out = out.replace('[Subtitle description]', esc(spec.get('subtitle', '')))
    out = out.replace('[Project Name] • [Additional metadata]',
                      esc(spec.get('footer', spec['title'])))
    start = out.index('<svg viewBox=')
    end = out.index('</svg>') + len('</svg>')
    out = (out[:start]
           + f'<svg viewBox="0 0 {width} {height}">\n        '
           + '<defs>\n'
             '          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">\n'
             '            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />\n'
             '          </marker>\n'
             '          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">\n'
             '            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5"/>\n'
             '          </pattern>\n'
             '        </defs>\n'
             '        <rect width="100%" height="100%" fill="url(#grid)" />\n        '
           + body + '\n      </svg>' + out[end:])
    cstart = out.index('<div class="cards">')
    cend = out.index('</div>\n\n    <!-- Footer -->')
    out = out[:cstart] + '<div class="cards">' + cards + '\n    ' \
        + out[cend:]
    return out


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    html_out = render_html(spec)
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        f.write(html_out)
    print(f'wrote {sys.argv[2]}')


if __name__ == '__main__':
    main()
