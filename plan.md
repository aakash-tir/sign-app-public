# Sign App — Original Plan

> **Note:** This is the original, lightly-edited plan as written by the project owner.
> The canonical, structured documentation derived from this plan lives in
> [`.claude/`](.claude/CLAUDE.md). Start there:
> - Product spec → [`.claude/project-context.md`](.claude/project-context.md)
> - Architecture → [`.claude/docs/architecture.md`](.claude/docs/architecture.md)
> - Recognition / ML → [`.claude/docs/recognition.md`](.claude/docs/recognition.md)
> - Milestones → [`.claude/docs/milestones.md`](.claude/docs/milestones.md)
> - Decisions → [`.claude/docs/decisions.md`](.claude/docs/decisions.md)

---

## Idea

The idea behind this project is to create a React app that can be used on
**Windows, Android, iOS, and Linux** to teach a user **sign language**.

There are levels: **beginner, intermediate, and expert**.

There are two modes: **Practice** and **Learn**.

## Learn mode

The flow is:

1. Show a sign with its meaning.
2. Make the user copy the sign.
3. Check with the phone camera whether it was done correctly.
4. If yes → "Good job".
5. If the user's proficiency is good enough, use the word in a sentence and
   track that the user copies it correctly.

## Practice mode

- There is a **word bank** with all the words that you know.
- The word is displayed on the screen.
- The user must show the sign for that word.
- If correct → display "Correct" and go on to the next word.
- There are two buckets of words: **confident** and **need-practice**.
  - If the user gets a word wrong, it goes into **need-practice**.
  - Initially, all new words go into **need-practice**.
  - If you get a word in **need-practice** correct **3 times**, it is moved into **confident**.
  - If a word in **confident** is got wrong, move it back to **need-practice**.
- There is **no "incorrect" screen**. If the user cannot get the sign correctly,
  they can click an **"I forgot"** button, which shows the sign.
  - On this screen there is a button that says **"That's what I did"**.
  - Sometimes the user signs correctly but the camera does not capture it
    correctly; if they click this button, assume the user got it right.
- In practice mode, pick words from the whole word bank regardless of confident
  or need-practice, at a **1:2 ratio** (more from need-practice). Unless there
  are no more words in the word bank, the same word cannot reappear within
  **10 words** displayed.

## Process requirements

- Fill in the rest of the gaps. The implementer has full authority to decide the
  tech stack and any other assumptions; only ask if it is a major,
  application-breaking question.
- Create a **private GitHub repository** for this project.
- Break the whole process into **milestones**.
- Document the code that is written in the `.claude` directory.
- For each milestone, use a **separate branch** and create a **PR** to
  squash-merge into `main`.
- At the end of each milestone, make sure all tests pass and run a format/lint
  check plus type checks. (Per the confirmed stack: **ruff format** + **mypy**
  for the Python ML pipeline; **ESLint/Prettier** + **tsc** for the
  TypeScript frontend.)
- For each milestone there should be tests to make sure all the features work.
- Only after all tests and format checks pass, merge the milestone and move on
  to the next.
- The implementer has permission to make code edits and merge the PRs.
