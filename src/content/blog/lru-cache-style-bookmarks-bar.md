---
title: BarFly - LRU cache style bookmarks bar
pubDate: '2026-06-26'
tags:
  - dev
---
Bookmarks are an essential part of using the internet if you're an information junkie like me. Over the years, I've tried different approaches to keeping them organised in folders. I eventually landed on a flat folder structure, with one folder per broad topic. Nested folders for subtopics added too much friction at the time of saving a bookmark - I'd have to spend a few extra seconds deciding where exactly it'd have to go. My principle with any kind of organizing system is that maintaining the organisation should take next to no effort at all. So flat folder structure worked. 

When I save something, it's for one of two reasons - I want to read this later, or this is interesting and I want to save it for posterity. But there's a fundamental problem with saving bookmarks, independent of how you organize them. The moment you save one, it goes out of sight, and you'd only see it again if you went to its specific folder and browsed through the list. I'd save all these links to check out later and completely forget about them, which I'm sure is an extremely common experience with bookmarks. Saving things to the bookmarks bar doesn't solve this issue either, because it shows items in the order in which they were added. There's no option to make it show the most recently added or visited items first, which I found surprising. This is a fairly basic feature that's present in any kind of file system, which the bookmarks manager is. It stores your bookmarks in a tree, just like other file systems. 

When thinking about all this, I had an idea - why not show the most recently interacted with bookmarks? Not only recently added or visited - both should count towards sorting. I realised that what I wanted was really my bookmarks bar to act as an LRU cache, and so I built an extension to do exactly that.

## How it works

The idea is simple - recently visited or added bookmarks get bumped to the top of the bar, and items that aren't interacted with get pushed towards the end and are eventually evicted. There is a capacity setting, which decides how many bookmarks are kept on the bar. Eviction kicks in once the bookmarks bar hits capacity. So, the user only sees items they've recently interacted with. If they add a bookmark for later reading, it stays on their bar for a while without disappearing into some folder. Repeated engagement keeps it on the bar because visits bump it to the top. Less relevant links naturally disappear over time. 

The extension works by taking over the bookmarks bar folder. All other folders are untouched. Users continue saving their bookmarks into their folders as usual. For every bookmark visited or added, the extension creates a duplicate on the bar and adds it to the top. Older items get deleted, which is fine because they're only duplicates. There are two sections on the bar, pinned and unpinned, split by a separator element. Items before the separator are pinned, and items there are never reordered or pruned. The dynamic list comes after the separator. Because the list is split by a separator, the extension doesn't have to explicitly track whether an item is static or dynamic, it only needs to know if the item comes before or after the separator, which is done by simply finding the separator and comparing indices.

Because the extension takes over the native bookmarks bar, several interactions needed explicitly defined behaviour.

- Saving items directly to the toolbar: These are moved to a separate 'Saved to bookmarks bar' folder since the bar should contain only duplicates.
- Deleting items from the toolbar: This is manual eviction, only the duplicate gets removed.
- Renaming items on the toolbar: The original in its folder also gets renamed. This works both ways, renaming an original also renames its duplicate on the toolbar.
- Moving/dragging items onto the toolbar: Original bookmarks can't be allowed on the bar since they might get evicted, and the user might unintentionally lose data. So when an item is moved to the toolbar, a duplicate is created and the original is moved back to its original folder. This is manually bumping a bookmark. 
- Dragging items across the separator pins/unpins them. There's also a context menu option to pin/unpin. 
- Folders on the toolbar: Folders are automatically moved to the pinned section.

## Architecture

- The bookmarks bar is the source of truth, there is no separate database. Because of this, the extension can resume working even on a fresh browser install if bookmarks are imported. On startup, the bar is read directly to rebuild a mapping of duplicates to their originals, which is used to handle renaming/deletion sync and to make sure only duplicates are ever evicted.

- Core logic to manage the duplicates and handle the LRU-style eviction is written as a standalone module independent of browser APIs. Browser APIs are called through an adapter layer, and I can switch this out to handle Chrome/Firefox APIs. This also meant that I could run the full test suite with a fake bookmark API and catch bugs in the logic. Right now, I only have a Firefox adapter because that's what I run, and I'll add Chrome support after more daily usage and testing.

I tried to build this extension in a way that makes it feel like this feature is just part of the existing bookmarks bar. It reuses things that are already there - the native toolbar, the separator element, browser events and bookmarks API. Coordinating everything involved some interesting challenges and making this work on top of the native toolbar meant that I had to handle lots of different edge cases, but getting this right gave me the LRU-style bookmarks organization I wanted, while being as unintrusive as possible.