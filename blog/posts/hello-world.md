---
title: Hello, World
date: 2026-10-01
description: A first post that exists mainly to prove the pipeline works. It does. Probably.
---

so this is the blog now. i built a generator so i could finally "focus on
writing", and i'm using it to write about the fact that the generator
works. peak output. peak engineering.

treat this as a smoke test. if the math below looks like math, the code
looks like code, and the picture isn't a broken-image icon, then the whole
thing is glued together correctly and i can go back to breaking production
somewhere else.

## the markdown still works

you get **bold**, *italic*, `inline code`, and [links that go
somewhere](/#work). nothing surprising in here yet.

## math, allegedly

there are two hard problems in computer science: cache invalidation,
naming things, and off-by-one errors.

$$
\underbrace{n}_{\text{slept}} + \underbrace{1}_{\text{more}} = n + 1
$$

inline, the complexity of reading your own code six months later is
$O(\text{nope})$, and the probability that a given bug is DNS tends toward
$\lim_{t \to \infty} P(\text{dns}) = 1$.

(confirming that $\sum_{i=1}^{n} \text{coffee}_i$ keeps its underscores —
it does. this is the entire feature and it works.)

## code, because of course

```rust
// works on my machine ™
fn main() {
    let bugs = ["it's DNS", "off by one", "the cache"];
    for bug in bugs.iter().cycle() {
        println!("blaming: {bug}");
    }
}
```

> it's not a bug, it's an undocumented feature with a different name.

## a table nobody asked for

| claim | confidence | source |
| ----- | ---------- | ------ |
| it's DNS | 99% | vibes |
| the cloud is just someone else's computer | 100% | the bill |
| i'll fix it later | 0% | git log |

## map

and because the assignment also wanted a frame, here's an `<iframe>` — a map
of bogor, where i live, which is somehow more useful than the table:

<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=106.73%2C-6.66%2C106.88%2C-6.53&amp;layer=mapnik&amp;marker=-6.5971%2C106.806" title="Map of Bogor, Indonesia" loading="lazy"></iframe>

## picture

here's the whole pipeline, as a diagram, because flowcharts are cheaper
than tests:

![A placeholder diagram](./diagram.svg "Figure 1 — source, build, page. that's the architecture.")

that's the post. if you're reading this in production then the smoke test
passed, and i've already wandered off to configure something with more
YAML in it.

— fabian
