---
title: LRU cache style bookmarks bar
pubDate: '2026-06-26'
tags:
  - dev
---
Bookmarks are an essential part of using the internet if you're an information junkie like me. Over the years, I've tried different approaches to keeping them organised in folders. I eventually landed on a flat folder structure, with one folder per broad topic. Nested folders for subtopics added too much friction at the time of saving a bookmark - I'd have to spend a few extra seconds deciding where exactly it'd have to go. My principle with any kind of organizing system is that maintaining the organisation should take next to no effort at all. So flat folder structure worked. 

When I save something, it's for one of two reasons - I want to read this later, or this is interesting and I want to save it for posterity. But there's a very basic problem with saving bookmarks, independent of how you organize them. The moment you save one, it goes out of sight, and you'd only see it again if you went to its specific folder and browsed through the list for some reason. So I'd save all these links to check out later and completely forget about them, which I'm sure is an extremely common experience with bookmarks. Saving things to the bookmarks bar isn't very helpful either, because it shows items in the order in which they were added. There's no option to make it show the most recently added or visited items first, which I found surprising. This is a fairly basic feature that's present in any kind of file system, which the bookmarks manager is. It stores your bookmarks in a tree, just like other file systems. 

When thinking about all this, I had an idea - why not show the most recently interacted with bookmarks? Not just recently added or visited, but both. I realised that what I wanted was really my bookmarks bar to act as an LRU cache, and so I built an extension to do exactly that.

## How it works

The idea is simple - recently visited or added bookmarks get bumped to the top of the bar, and items that weren't interacted with get pushed towards the end and are eventually evicted. The user only sees items they've interacted with. If they add a bookmark for later reading, it stays on their bar for a while without disappearing into some folder. Repeated engagement keeps links on the bar because visits bump them to the top. Less relevant links naturally disappear over time because of eviction. 

The extension works by taking over the bookmarks bar folder and managing that. All other folders are untouched. Users continue saving their bookmarks into their folders as usual. For every bookmark visited or added, the extension creates a duplicate on the bar and adds it to the top. Older items get deleted, which is fine because they're only duplicates. There are two sections on the bar, pinned and unpinned, split by a separator element. Items before the separator are pinned, and items there are never reordered or pruned. The dynamic list comes after the separator. 

Because the extension takes over the native bookmarks bar, a lot of behaviours had to be properly defined. 

- Saving items directly to the toolbar: these are moved to a separate 'Saved to bookmarks bar' folder since the bar should contain only duplicates.
- Deleting items from the toolbar: this is basically manual eviction
- Renaming items on the toolbar: the original in its folder also gets renamed
- Moving items to the toolbar: original bookmarks can't be allowed since they might get deleted. So when an item is moved to the toolbar, a duplicate is created and the original is moved back to the original folder. This is basically manually bumping a bookmark. 
- Dragging items across the separator pins/unpins them. There's also a context menu option to pin/unpin. 

## Architecture

- The bookmarks bar is the source of truth. Because of this, the extension can resume working even on a fresh browser install if bookmarks are imported. 

- Core logic to manage the duplicates and handle the LRU-style eviction is written as a standalone module independent of browser APIs. Browser APIs are called through an adapter layer, and I can switch this out to handle Chrome/Firefox APIs. Also helps to test the core logic easily.
