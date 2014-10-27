---
layout: vis
title: Vis
---

<script type="text/javascript">
</script>

<svg width="500" height="50">
    <rect x="0" y="0" width="500" height="50"/>
</svg>

<svg width="500" height="50">
    <rect x="0" y="0" width="500" height="50"/>
</svg>

<svg width="500" height="50">
    <ellipse cx="250" cy="25" rx="100" ry="25"/>
</svg>

<svg width="500" height="50">
    <line x1="0" y1="0" x2="500" y2="50" stroke="black"/>
</svg>

<svg width="500" height="50">
    <text x="250" y="25">Easy-peasy</text>
</svg>

<svg width="500" height="50">
    <text x="250" y="25" font-family="sans-serif"
          font-size="25" fill="gray">Easy-peasy
    </text>
</svg>

<p>Can style SVG through CSS</p>
<style type="text/css">
    svg .pumpkin {
        fill: yellow;
        stroke: orange;
        stroke-width: 5;
    }
</style>
<svg width="500" height="50">
    <circle cx="25" cy="25" r="22" class="pumpkin"/>
</svg>

<p>Layering is defined by the order of the elements within the svg</p>
<svg width="500" height="50">
    <rect x="0" y="0" width="30" height="30" fill="purple"/>
    <rect x="20" y="5" width="30" height="30" fill="blue"/>
    <rect x="40" y="10" width="30" height="30" fill="green"/>
    <rect x="60" y="15" width="30" height="30" fill="yellow"/>
    <rect x="80" y="20" width="30" height="30" fill="red"/>
</svg>

<p>Opacity</p>
<svg width="500" height="50">
    <circle cx="25" cy="25" r="20"
            fill="rgba(128, 0, 128, 0.75)"
            stroke="rgba(0, 255, 0, 0.25)" stroke-width="10"/>
    <circle cx="65" cy="25" r="20"
            fill="rgba(128, 0, 128, 0.75)"
            stroke="rgba(0, 255, 0, 0.25)" stroke-width="10"
            opacity="0.5"/>
    <circle cx="105" cy="25" r="20"
            fill="rgba(128, 0, 128, 0.75)"
            stroke="rgba(0, 255, 0, 0.25)" stroke-width="10"
            opacity="0.2"/>
</svg>