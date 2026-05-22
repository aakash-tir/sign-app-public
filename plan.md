# Phase 2 of the Project

Phase 1 (M0–M7) shipped a working PWA, but it has real limitations. Right now we
have a very small dataset with limited data and limited signs, and the app sends
users to external sites to learn the signs for words and dynamic signs — that
should not be the case. There are several things to fix and improve; the items
below go through them one at a time.

## 1. Expand the dataset (with a normalization layer first)

The datasets we have are not enough: currently one dataset for the letters and two
Kaggle datasets. That isn't enough data, so I want to expand what we use.

Before expanding, we need a solid **data normalization layer**. New data will be
messy and come in different sizes. The pipeline should accept **one canonical
size / a fixed set of restrictions** for incoming data, with a normalization layer
that adjusts everything into that format.

**Order of work:** prove the normalization layer works for the *current* setup
before introducing any new data.

## 2. Redesign the UI

The current UI is a dark screen with low-contrast buttons that are hard to see.

![Settings screen](images/app1.png)
![Learn screen](images/app2.png)

In its current state I would not want to use the app — it needs a design redo that
makes it look better.

## 3. Fix camera re-permission on tab switch

Every time I switch tabs I have to re-enable the camera. The camera does not store
data on the local device, so:

- Ask for camera access **once**, with an explanation that no data is stored — so
  the user doesn't have to re-enable it on every tab switch.
- Still allow the user to **disable and re-enable** the camera themselves whenever
  they want.

## 4. Teach signs in-app (no external sites)

We do not want users going to other sites to learn sign language — that defeats the
whole point of the app. We need a set of **images** that show each sign, displayed
alongside the description.

- The images **must be copyright-free** so we don't get sued.
- **Videos** would also work, but they will be a lot harder to find.

## 5. Per-finger colors in the hand tracker

During finger/joint tracking, each finger should be identified specifically rather
than the whole hand being drawn uniformly.

![Hand tracking overlay](images/fi.png)

Currently pink dots and blue lines are used for the hand and everything else is
green. Could we use **different colors per finger** — e.g. the thumb has different
lines and dots from the index, and so on — with the palm staying the default
colors? If we draw it this way, similar hand signs should be easier to tell apart
and identify.

What do you think of this?
