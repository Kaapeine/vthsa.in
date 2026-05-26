---
title: 'This website'
description: 'How I built this website in Astro'
externalUrl: 'https://vthsa.in'
year: 2026
tags: ['astro', 'webdev', 'p5.js']
---

I'd been wanting to build a new website for a while now. I've made so many of these in the past and I'd always stop maintaining them after a while. But now I have so many ideas for little things I could make for the web and so I thought I'd give it another go. This time I had some requirements:
- Be as close to HTML as possible: I'd used Hugo for some of my websites earlier because I love using Markdown to manage the actual content, but adding any custom HTML or JS to my Hugo pages was a pain because all of those things happened only at the template level. I really wanted to add custom p5 code to my website.
- Not be just a bunch of HTML pages I have to individually maintain: I've done this and it was way too much effort to add any content

I've been experimenting with Claude Code, and so I used that to try out a bunch of different options, like building my own static site generator in Go, having Claude make edits to Hugo themes, a full blown React app. It was a fun to go through all these iterations so quickly and kind of figure out how to use these AI coding tools without letting them get ahead of me. 

I went to my first IndieWebClub hoping to get some ideas from people there, and I was recommended Astro. I've been learning more about it ever since I started this website and it's been amazing. I can
- write all my blogs in markdown
- create templates for new pages easily
- direct control over HTML and JS

The same person who recommended I use Astro also told me about Superpowers, a plugin for Claude Code. I've been using it ever since and it's honestly been a huge productivity boost. I spend so much time debating with Claude about every little detail before having it write me a plan, and I've been learning so much in the process. Still unsure about how I feel about all this, because the entire coding process looks so different now. But at this point, I have to admit that these tools are just far too useful to ignore. I was able to build this site out in 2 days and add all kinds of cool custom features that would've taken me so much time before. 

Like for example, the layout of this site is two divs positioned over each other, with a p5 canvas attached to the one in the background. It was fairly annoying to get this to work because placing a div over a canvas can cause huge parts of it to not render. I did this once before when I built out my blog in just HTML but I remember how painful it was to get the layout to work. But Claude was able to get all this working in no time at all, and also get the website to be responsive and mobile friendly.
