//
// An implementation of a collapsible file system (folders and files)
// hierarchy layout.
//
// Based on
//   - https://gist.github.com/mbostock/1093025
//   - https://observablehq.com/@d3/indented-tree
//

//
// Input:
//   d3 - A d3 instance
//   container_id - the id of an (empty!) <div> element in which
//       everything will be rendered
//   min_height - the height of the enveloping container <div> element
//       will be adjusted based on the content but will be kept at least
//       this high
//   tooltip_key - the key in a data entry from which the tooltip text
//       will be retrieved. A 'null' value suppresses the rendering of
//       tooltips.
//
export function FolderTree(d3, container_id, min_height, tooltip_key) {
    "use strict"

    // SVG-level constants
    const margin = { top: 40, right: 20, bottom: 40, left: 20 }
    const width = 800;

    // Row-level constants
    const row_height = 27;     // of each display row
    const row_width = (width - margin.left - margin.right) * 0.8;
    const indentation = 22;    // of nested items
    const icon_width = 14;     // of folder/file icons

    let id = 0;                // node index
    const duration = 400;      // of transition animation
    let root;                  // of the entire tree

    // Color palette
    const seasalt = "#f8f9fa";          // lightest
    const antiflash_white = "#e9ecef";
    const platinum = "#dee2e6";
    const french_gray = "#ced4da";
    const french_gray2 = "#adb5bd";
    const slate_gray = "#6c757d";
    const outer_space = "#495057";
    const onyx = "#343a40";
    const eerie_black = "#212529";      // darkest

    // Element id's
    const container_id_str = "#" + container_id;
    const svg_id = container_id + "_folder_tree_svg";
    const svg_id_str = "#" + svg_id;

    // Sanity check tooltip_key, if provided
    let tooltip_key_str = null;
    if (tooltip_key !== null) {
        if (typeof tooltip_key === 'string' || tooltip_key instanceof String) {
            tooltip_key_str = tooltip_key;
        }
    }

    // Tooltip area. Note: it must hang off the body rather than the svg for
    // proper positioning, as the mouse coordinates are relative to the screen.
    const tooltip = d3.select(container_id_str)
      .append("div")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("opacity", 0)
        .style("background-color", antiflash_white)
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "4px")
        .style("border-color", french_gray2)
        .style("padding", "5px")
        .style("font-size", "13px");

    const svg = d3.select(container_id_str)
      .append("svg")
        .attr("id", svg_id)
        .attr("width", width)
        .style("background-color", seasalt)
        .style("border", "solid")
        .style("border-width", "3px")
        .style("border-radius", "8px")
        .style("border-color", outer_space)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    function load(json_file) {
        d3.json(json_file, function (error, data) {
            if (error) throw error;
            root = d3.hierarchy(data);
            root.x0 = 0;
            root.y0 = 0;
            update(root);
        });
    }

    // Open folder / closed folder / file glyphicons
    function folder_icon(d) {
        return Object.hasOwn(d, "children") ? "\ue118" : (Object.hasOwn(d, "_children") ? "\ue117" : "\ue022");
    }

    function update(source) {
        const data_nodes = root.descendants();

        // Update svg
        const height = Math.max(min_height, data_nodes.length * row_height + margin.top);
        d3.select(svg_id_str).transition()
            .duration(duration)
            .attr("height", height);

        d3.select(self.frameElement).transition()
            .duration(duration)
            .style("height", height + "px");

        // Calculate the position of each node
        let row = -1;
        root.eachBefore(function (n) {
            n.x = n.depth * indentation;
            n.y = ++row * row_height;
            n.row = row;
        });

        // Update the nodes' data
        const nodes = svg.selectAll(".node")
            .data(data_nodes, function (d) { return d.id || (d.id = ++id); });

        // Adjust node DOM elements
        const entering_nodes = nodes.enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) { return "translate(" + source.x0 + "," + source.y0 + ")"; })
            .style("opacity", 0);

        // Insert glyphicon
        const entering_glyphicons = entering_nodes.append("text")
            .attr("class", "glyphicon")
            .attr("y", -row_height / 2)
            .attr("dy", 3.5)
            .attr("height", row_height)
            .attr("width", row_width)
            .style("fill", glyphicon_color);
        entering_glyphicons
          .filter(function (d) {
                // D3 seems to not create 'd.children' if 'd.data.children' is
                // an empty array, so we create it on our own since the code
                // relies on its existence to indicate a directory.
                // This must run before any code which assumes that 'd.children'
                // is set correctly, e.g. 'folder_icon'.
                if (Object.hasOwn(d.data, "children") && d.data.children.length == 0) {
                    // Don't set 'd.children' if this is a re-entering node
                    if (!Object.hasOwn(d, "children") && !Object.hasOwn(d, "_children")) {
                        d.children = null;
                    }
                }
                // A node can be either expanded or collapsed when entering so
                // we must check both its 'children' and '_children' properties.
                return Object.hasOwn(d, "children") || Object.hasOwn(d, "_children"); })
            .on("click", click);
        entering_glyphicons
            .text(d => folder_icon(d));

        // Insert the file/folder name
        const entering_text_elements = entering_nodes
          .append("text")
            .attr("class", "filename")
            .attr("dx", d => Object.hasOwn(d, "children") ? 22 : 20)
            .attr("y", -row_height / 2)
            .attr("dy", 3.5)
            .attr("height", row_height)
            .attr("width", row_width)
            //.style("pointer-events", tooltip_key_str === null ? "none" : "all")
            .text(function (d) { return d.data.name; });

        // Add tooltip mouse handlers if needed
        if (tooltip_key_str !== null ) {
            entering_text_elements
                .on("mouseover", function (d) {
                    return tooltip
                        .transition().duration(400)
                        .style("opacity", 1);
                })
                .on("mousemove", function (d) {
                    return tooltip
                        .text(d.data[tooltip_key_str])
                        .style("white-space", "pre-line")
                        .style("top", (d3.event.pageY + 10) + "px")
                        .style("left", (d3.event.pageX + 10) + "px");
                })
                .on("mouseout", function (d) {
                    return tooltip
                        .style("opacity", 0);
                });
        }

        // Transition entering nodes to their new positions
        entering_nodes.transition()
            .duration(duration)
            .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
            .style("opacity", 1);

        nodes.transition()
            .duration(duration)
            .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
            .style("opacity", 1);

        // Transition exiting nodes to the parent's new position
        nodes.exit().transition()
            .duration(duration)
            .attr("transform", function (d) { return "translate(" + source.x + "," + source.y + ")"; })
            .style("opacity", 0)
            .remove();

        // Update the links' data
        const link = svg.selectAll(".link")
            .data(root.links());

        // Enter any new links at the parent's previous position
        const source_vertical_offset = -7;
        const target_vertical_offset = -16;
        link.enter().insert("path", "g")
            .attr("class", "link")
            // We use 'source' (which is the pivot node of the update) rather
            // than 'd.source' to anchor the starting point of the animation.
            .attr("d", d => `
                M${source.depth * indentation + icon_width/2},${source.row * row_height + source_vertical_offset}
                V${source.row * row_height + source_vertical_offset}
                H${0}
            `)
          .transition()
            .duration(duration)
            .attr("d", d => `
                M${d.source.depth * indentation + icon_width/2},${d.source.row * row_height + source_vertical_offset}
                V${d.target.row * row_height + target_vertical_offset}
                h${indentation - icon_width/2 - 2}
            `);

        // Transition links to their new position
        link.transition()
            .duration(duration)
            .attr("d", d => `
                M${d.source.depth * indentation + icon_width/2},${d.source.row * row_height + source_vertical_offset}
                V${d.target.row * row_height + target_vertical_offset}
                h${indentation - icon_width/2 - 2}
            `);

        // Transition exiting links to the parent's new position
        link.exit()
          .transition()
            .duration(duration)
            .attr("d", d => `
                M${source.depth * indentation + icon_width/2},${source.row * row_height + source_vertical_offset}
                V${source.row * row_height + source_vertical_offset}
                h0
            `)
            .remove();

        // Stash the old positions for transition
        root.each(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // Toggle children on click
    function click(d) {
        if (Object.hasOwn(d, "children")) {
            d._children = d.children;
            delete d.children;
        } else {
            d.children = d._children;
            delete d._children;
        }
        d3.select(this)
            .text(d => folder_icon(d))
            .style("fill", glyphicon_color);
        update(d);
    }

    function glyphicon_color(d) {
        return Object.hasOwn(d, "_children") ? slate_gray : Object.hasOwn(d, "children") ? eerie_black : onyx;
    }

    return {
        load,
    };
}
