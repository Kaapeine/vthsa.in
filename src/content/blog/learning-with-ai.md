---
title: Learning with AI
pubDate: '2026-06-15'
description: I made a learning companion skill
tags:
  - ai
  - writing
---
##### Download the SKILL.md from the GitHub repo [here](https://github.com/Kaapeine/learning-companion-skill).

I've been spending a lot of time working on my audio analysis project. The current iteration of that is shaping up nicely to be a mix comparison tool, but more on that another time. Since the start of the project, I've been having it explain to me every single change it makes. It keeps forgetting to do it though, so I've come up with a short prompt I use every session. "Continue with the plan/task/etc. For every task, make the edits, explain all changes, explain what is verifiable and ask me to check, and only then commit." This does the trick. I still have no idea why it doesn't recall it from its memory though, it is stored as a preference. 

I was working with PostgreSQL and I wanted to understand how it actually works underneath. So, I started asking questions about it inside my project, and that worked really well. It gave me a lot of clean explanations of the exact mechanisms of the write ahead log, MVCC, B-trees, the file storage layer. The best part was how it would always tie it back to the app I'm building. The examples and tradeoffs it gave me were always something directly relevant to what I was doing. So I had this idea that AI could be a really powerful personal tutor, which can guide you through subjects in a way that's exactly suited to your learning preferences. 

But at the same time, I was still skeptical. I wasn't so worried about hallucinations because this is almost like direct retrieval. The info I want is definitely out there, even laid out neatly in wikis, tutorials, textbooks, courses, etc. My concern was more about the actual learning. When I'm learning something technical, I'll keep going until the idea "clicks" in a way. Sometimes that's enough, all I needed was a general picture. But what if I actually wanted to gain real knowledge of a subject? I don't know what I don't know. And I don't know something until I actually try it and run into all the cracks that aren't visible from that top level understanding. Gaining real knowledge takes effort, trial and error, practice, persistence.

So these were the main problems in trying to make an AI learning companion:
1. Human effort: just reading answers is not enough
2. I don't know what I don't know, so just me asking questions won't get me far
3. Persistence: learning takes time and AI conversations are ephemeral. They don't even let you take a clean export of the chat. And summaries are too impersonal to serve as notes.

After a whole bunch of brainstorming, I found a clean solution to these problems - a user maintained document of what they're learning.

I've created a SKILL.md for this learning companion tool. This fetches a HTML template I made and the AI bootstraps this document when you first go to it to start learning something. The HTML document is your main reference point for everything. It will contain your notes and this is what you'll keep coming back to as you learn something. The core idea is that the notes in this document aren't AI generated, it's something you write and maintain. AI can add content around your notes, but can never touch them. 

Here's how the whole flow works:
1. Add the skill to the chat and start the conversation. 
2. What you want to learn can be anything, you can start with an exact topic, a list of keywords, a course syllabus, anything. The AI will listen to whatever you describe and try to see the bigger picture. 
3. The AI will do an orientation for itself: figure out what you want to learn, how deep you want to go, what your current level of understanding is.  
4. The AI will propose a list of topics and you can add/remove as you please. This list is just meant to act as a loose guide, in case the conversations stray too far off from what's relevant. 
5. Once the orientation is done, it will save all of this info in the HTML document. The subject being learnt, the list of topics, and the most important ones: AI state and prompt. 

### AI State:
The document contains a JSON which stores all of your learning preferences. It'll remember how you learn, what you're bad at, what you respond well to, the depth setting, and more. This is how the AI knows how to continue when you come back to learn more. By persisting both the state and the prompt in the document itself, it becomes self-bootstrapping. You can just start a fresh conversation with the document and pick up where you left off. All you need is the document. 

6. The AI starts with the first topic. From this point, it's up to you. You can go as fast or slow as you want. It will introduce new concepts at the right time and ask you tricky questions to make you figure it out. "Socratic learning" is the idea. It will just tell you the answers if you'd like. During the actual conversation, it's really all up to you.

7. After some time, if the AI thinks you've reached a logical place to stop, it will ask you to write a checkpoint. This is my solution to the human effort problem. A checkpoint is when you have to rewrite in your own words everything you've learned. It's not a test, you can still ask the AI to reexplain things if you'd like. But the whole point is you put in the effort and try to write a note for yourself to read later. The AI will read what you've written, suggest corrections and edits, and once you're done, it's committed into the document. Checkpoint = your learning notes, but vetted by AI. 
8. As you continue, the only thing being added to the document is your notes. That's all you see in the document. So it will feel like something you personally put effort into, not simply generated using AI.

That's it. The whole document and prompt is just to make the learning more structured, persistent across conversations while also making you put in effort to retain the friction of learning. 

There are some other generative features which are secondary to the things I've talked about so far. 
1. AI generates a concept map from the list of topics and puts it in the document. It also adds to it if you go on tangents. Added it because it was fun to see. 
2. AI will ask you if you want illustrations, interactive elements, charts, etc., whenever it thinks it could make a useful one. This one is really neat and is actually the whole reason I made the document HTML and not just a Markdown file. It can just generate js or svg and explain stuff to you.

Some other details:
- AI also maintains a simple log of the conversation in the document. It's brief, and it's mainly for future context. 
- It will also maintain a transcript if you want. This involves maintaining another MD file, but it's an option. You just have to upload the old file and it will append to it. But it's not the actual transcript, just a paraphrased version, because these models don't give you the full one, atleast on the app versions.
