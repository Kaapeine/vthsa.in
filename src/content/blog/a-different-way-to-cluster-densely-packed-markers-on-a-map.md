---
title: 'A different way to show densely clustered markers on a map'
pubDate: 'July 2 2026'
tags:
    - dev
    - maps
---

I came across [this article](https://blog.greg.technology/2026/06/12/map-clustering-is-not-my-favorite.html) on HackerNews which talked about the problem of having a lot of markers on a map packed in one region. The default of handling this is to cluster all nearby markers into one marker for that region which just shows a count of how many markers this one is hiding. Clicking on the cluster marker expands all of them into a spider like display. But the problem is, when collapsed, the count just doesn't look very nice. If each marker has different icons, all this visual information is hidden behind a plain number now. 

I was driving home from a friend's one night and thinking about this problem. In my head, I was explaining the issue to someone, and when I got around to talking about a solution, I spontaneously thought of an idea that made sense. Honestly, I felt like an LLM, like I generated the solution through next token prediction. The idea was to show all markers without clustering, and to solve the problem of overlapping, I would use a physics based algorithm to keep them spaced apart. 

I wanted to build a general solution for this, something that would work at scale. The HN post that inspired this used the [Atlas Obscura dataset](https://www.atlasobscura.com/articles/all-places-in-the-atlas-on-one-map), and I also went with that. I found the entire dataset in the FGB format on [Reddit](https://www.reddit.com/r/DataHoarder/comments/18arn2a/a_company_is_probably_going_to_disappear_at_some/kc1jjwp/). Since I wanted to build something performant, I used [MapLibre GL](https://maplibre.org/projects/gl-js/) which renders vector maps using WebGL. The maps themselves came from the very generous [OpenFreeMap](https://openfreemap.org/) API.

The algorithm works by building a quadtree of all points in the current view. For every point, it finds the nearest neighbours and calculates a displacement based on overlap. It also calculates a spring force based on how far away the marker is from its true geographic location, in order to pull it closer and prevent it from drifting away. 

The hard part was tuning the algorithm to make it work for different zoom levels. At very high zoom levels, the markers should just be directly over their actual positions. At slightly lower levels, they form packed clusters around their neighbourhoods. At the city scale, if zoomed out enough, they form giant clusters of all points in the city.

But going lower than this is where I started to see some issues. The leader lines i.e. the lines from the markers that point at their true location, would increase in length indefinitely. Markers from all over the country would end up forming a giant cluster. To solve this, I had to scale the lines and the markers themselves based on the zoom level. At very low zoom levels, there's not much point in keeping them spaced apart, because they end up extremely far from their true locations. For this case, they collapse down to small markers at their actual locations, and the simulation actually turns off if there are more than 1500 points in the viewport, because at that scale, spreading them apart doesn't make sense.

The spacing works best for medium level zoom scenarios, and I think it's a good compromise. At city level zooms, all markers are visible roughly close to their true locations and they don't have to be hidden behind a grouped cluster marker.

Here's what it looks like in action (sped up 3x):

<video src="/declutter-demo.mp4" autoplay muted loop playsinline controls style="width:100%;height:auto;border-radius:8px;"></video>

Check out the demo here:
- [India](/declutter/india) - 473 markers
- [Global](/declutter/global) - 26,479 markers