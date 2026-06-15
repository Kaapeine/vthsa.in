---
title: 'Song Composition Analyzer'
description: 'A web app to run MIR models on songs and extract stems, key, chords, chord progressions, tempo, loudness, tension. Superseded by CohereMix'
externalUrl: ''
thumbnailImage: 'songcomposition_thumbnail.png'
date: 2026-05-15
tags: ['audio', 'webdev', 'python']
---

I had an idea to build out a tool for musicians and composers that would help them break a song down quickly. To understand a song, we first need to know what the overall structure is, which comes from the arrangement of different sections. So I first had to extract section information from a song. When I was looking into this problem, Claude recommended [allin1](https://github.com/mir-aidj/all-in-one) which was a single model that could provide sections, along with key, detected beats and stems. I thought this would be a great starting point and I started working on the application. 

I chose Python for the backend because it has the most support for audio analysis workflows. And to keep things simple, I used FastAPI for the HTTP handlers and also to serve the frontend statically. The frontend is built as a React SPA. I used PostgreSQL for the database layer to store the analysis results. In hindsight, I could've gone with a much lighter database as I had to use Docker Compose to be able to run an isolated version of PostgreSQL just for my app. 

![upload](./../../../public/songcomposition_upload.png)
![loading](./../../../public/songcomposition_loading.png)
![thumbnail](./../../../public/songcomposition_thumbnail.png)
![signallane](./../../../public/songcomposition_signallane.png)
![stems](./../../../public/songcomposition_stems.png)

