---
title: Hello
date: 2026-10-01
description: The first post. A placeholder, mostly.
---

oh, hi.

This is a placeholder post — it exists so the blog pipeline has something
to render. Replace it by editing `blog/posts/hello-world.md`, or delete
the file and run `bun run build` again.

A quick tour of what the Markdown renderer handles:

- **bold**, *italic*, and `inline code`
- links, like [the home page](/#work)
- fenced code blocks:

```go
func main() {
	fmt.Println("hello, world")
}
```

> Blockquotes too, if you're into that.

## Math

Inline math, like $E = mc^2$ or $O(n \log n)$, and a display equation:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

Underscores and backslashes survive because equations are pulled out before
Markdown runs: $\sum_{i=1}^{n} a_i$ renders intact.

## Images

Images next to this file are copied next to the page, so a relative path
just works. Give one a title and it becomes a captioned figure:

![A placeholder diagram](./diagram.svg "Figure 1 — source, build, page.")

That's it. Delete this file and write something real.
