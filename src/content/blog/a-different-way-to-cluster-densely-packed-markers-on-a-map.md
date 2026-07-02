---
title: A different way to show densely clustered markers on a map
pubDate: '2026-07-02'
updatedDate: '2026-07-02'
tags:
  - dev
  - maps
---
I came across [this article](https://blog.greg.technology/2026/06/12/map-clustering-is-not-my-favorite.html) on HackerNews which talked about the problem of having a lot of markers on a map packed into one region. The most common way to handle this is to cluster all nearby markers into one marker for that region which just shows a count of how many markers this one is hiding. Clicking on the cluster marker expands all of them into a spider like display. But the problem is, when collapsed, the count just doesn't look very nice. If each marker has different icons, all this visual information is hidden behind a plain number now. 

One night, I was thinking about this problem while driving home from a friend's. In my head, I was explaining the issue to someone, and when I got around to talking about a solution, I spontaneously thought of an idea that made sense. At that moment, I felt like an LLM, like I generated the solution through next token prediction while having an imaginary conversation. The idea was to show all markers without clustering, and to solve the problem of overlapping, I would use a physics based algorithm to keep them spaced apart, while drawing a line to connect it to its actual geographic location.

I wanted to build a general solution for this, something that would work at scale. The HN post that inspired this used the [Atlas Obscura dataset](https://www.atlasobscura.com/articles/all-places-in-the-atlas-on-one-map), and I also went with that. I found the entire dataset in the FGB format on [Reddit](https://www.reddit.com/r/DataHoarder/comments/18arn2a/a_company_is_probably_going_to_disappear_at_some/kc1jjwp/). Since I wanted to build something performant, I used [MapLibre GL](https://maplibre.org/projects/gl-js/) which renders vector maps using WebGL. The maps themselves came from the very generous [OpenFreeMap](https://openfreemap.org/) API.

The algorithm works by building a quadtree of all points in the current view. For every marker, it finds its nearest neighbours and calculates a displacement based on overlap. It also calculates a spring force based on how far away the marker is from its true geographic location, in order to pull it closer and prevent it from drifting away completely. The simulation runs whenever the map moves (zoom and pan) and outputs the final pixel positions of the markers. The actual markers are drawn by a WebGL layer which is then passed to MapLibre GL.

The hard part was tuning the algorithm to make it work for different zoom levels. At very high zoom levels, the markers were directly over their actual positions. At slightly lower levels, they formed packed clusters around their neighbourhoods. At the city scale, if zoomed out enough, they'd form giant clusters of all points in the city. So far, so good.

But zooming out even further, I started to see some issues. The leader lines i.e. the lines from the markers that point at their true location, would increase in length indefinitely. Markers from all over the country would end up forming a giant cluster. To solve this, I had to scale down both the lines and the markers based on the zoom level. At very low zoom levels, there wasn't not much point in keeping them spaced apart, because they would end up extremely far from their true locations. For this case, the leader lines shorten and the markers smoothly collapse down to small markers at their actual locations, and the physics simulation turns off if there are more than 1500 points in the viewport, because at that scale, spreading them apart didn't make sense.

The spacing works best for medium level zoom scenarios, and I think it's a good compromise. At city level zoom, all markers are visible roughly close to their true locations and they don't have to be hidden behind a grouped cluster marker.

Here's what it looks like in action:

<video src="/declutter-demo.mp4" autoplay muted loop playsinline controls style="width:100%;height:auto;border-radius:8px;"></video>

Check out the demo here:
- [India](/declutter/india) - 473 markers
- [Global](/declutter/global) - 26,479 markers
