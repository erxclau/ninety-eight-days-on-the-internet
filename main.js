const wrap = (text, width) => {
    text.each(function () {
        let text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1, // ems
            y = text.attr("y"),
            x = text.attr("x"),
            dy = 1,
            tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    });
}

const delay = time => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, time);
    });
};

const draw_head = async () => {
    let head = document.getElementById('head-graphic');
    let domain_set = await d3.json('./json/domain/set.json');

    for (const domain of domain_set) {
        for (const letter of domain) {
            await delay(100);
            head.textContent += letter;
        }
    }
}

window.onload = async () => {    
    let domain_top = await d3.json('./json/domain/top.json');

    let comma = d3.format(',');

    let bubble = 
        d3.select('#bubble');

    const width = bubble.select(function() { return this.parentNode }).node().clientWidth;
    const height = width;

    bubble
        .attr('viewBox', [0, 0, width, height])
        .attr('font-family', 'sans-serif');

    let hierarchy = 
        d3.hierarchy({children: domain_top}).sum(d => d.visits);

    let pack = 
        d3.pack()
            .size([width, height])
            .padding(3)
            (hierarchy);

    const fill_circle = d => ("color" in d.data) ? d.data.color : "gray";

    let leaf = 
        bubble.selectAll('g')
            .data(pack.leaves())
            .join('g')
                .attr('transform', d => `translate(${d.x + 1}, ${d.y + 1})`)
    
    let circle = 
        leaf.append('circle')
            .attr('r', d => d.r)
            .attr('stroke', 'black')
            .attr('stroke-width', 0)
            .attr('fill', fill_circle)

    let tooltip = 
        d3.select('main')
            .append('div')
                .attr('class', 'd3-tip')
                .style('position', 'absolute')
                .style('display', 'none')

    circle
        .on('mouseenter', function(e, d) {
            let domain = d.data.domain;
            let label = ("label" in d.data) 
                ? d.data.label 
                : domain.charAt(0).toUpperCase() + domain.slice(1)

            let alt = (domain !== label) ? `(${domain})` : String();

            tooltip
                .style('display', 'block')
                .html(`
                    <b>${label}</b> ${alt}<br>
                    ${comma(d.data.visits)} visits`)
            d3.select(this)
                .attr('stroke-width', 1)
        })
        .on('mousemove', function(e) {
            let x = e.pageX + 5;
            let shift = (x > window.innerWidth * 0.5) ? x - 170 : x;
            tooltip
                .style('visibility', 'visible')
                .style('top', `${e.pageY - 40}px`)
                .style('left', `${shift}px`)
        })
        .on('mouseleave', function() {
            tooltip
                .style('display', 'none');
            d3.select(this)
                .attr('stroke-width', 0)
        })

    const trans = () => d3
            .transition()
            .duration(500)
            .ease(d3.easeLinear);

    const is_genius = d => ("color" in d.data) ? d.data.color === "#FFFF64" : false;
    let not_genius = circle.filter(d => !is_genius(d))
    let genius = circle.filter(is_genius);

    let swarm_data = await d3.json('./json/genius/main.json');
    swarm_data.reverse();
    let time = d3.timeParse('%Y-%m-%d %H:%M:%S');
    let tformat = d3.timeFormat("%I %p")

    const margin = {left: 25, bottom: 20, right: 25, top: 20};

    let x = d3.scaleTime()
        .domain(d3.extent(swarm_data, d => time(d.time))).nice()
        .range([margin.left, width - margin.right]);

    let axis = bubble.append('g')
        .attr('transform', `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(tformat))
        .attr('visibility', 'hidden');

    let geniuses = bubble.selectAll('.genius')
        .data(swarm_data)
            .join('circle')
                .attr('class', 'genius')
                .attr('cx', d => x(time(d.time)))
                .attr('cy', height / 2)
                .attr('r', 0)
                .attr('stroke-width', 1)
                .attr('fill', 'transparent');

    function set_mouse(selection) {
        selection
            .on('mouseenter', function(e, d) {
                if ("title" in d) {
                    tooltip
                    .style('display', 'block')
                    .html(`
                        <b>${d.title}</b><br>
                        ${d.time.toString()}`)
                }
                d3.select(this)
                    .attr('stroke-width', 2)
            })
            .on('mousemove', function(e) {
                let x = e.pageX + 5;
                let shift = (x > window.innerWidth * 0.5) ? x - 170 : x;
                tooltip
                    .style('visibility', 'visible')
                    .style('top', `${e.pageY - 40}px`)
                    .style('left', `${shift}px`)
            })
            .on('mouseleave', function() {
                tooltip
                    .style('display', 'none');
                d3.select(this)
                    .attr('stroke-width', 1)
            })
    }

    set_mouse(geniuses);

    let tick = () => {
        geniuses
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
    }

    let sim = d3.forceSimulation(swarm_data)
        .force('x', d3.forceX(d => x(time(d.time))).strength(0.75))
        .force('y', d3.forceY(height / 2).strength(0.05))
        .force('collide', d3.forceCollide(5))
        .on('tick', tick)

    let extra = await d3.json('./json/genius/extra.json');
    let combine = swarm_data.concat(extra);

    let scoller = scrollama();
    scoller
        .setup({
            step: ".step",
            offset: 0.75
        })
        .onStepEnter(async res =>  {
            if (res.index === 0 && res.direction === "down") {
                not_genius
                    .transition(trans())
                    .attr('fill', 'transparent')
                    .attr('pointer-events', 'none');

                let t = genius.select(function() {
                    return this.parentNode
                }).attr('transform');

                genius
                    .transition(trans())
                    .attr('stroke-width', 1)
                    .attr('pointer-events', 'none')
                    .attr('cx', (width / 2) - Number(t.substring(10, t.indexOf(','))))
            }
            if (res.index === 1 && res.direction === "down") {
                genius 
                    .transition(trans())
                    .attr('fill', 'transparent')
                    .attr('stroke-width', 0);

                geniuses
                    .transition(trans())
                    .attr('r', 7)
                    .attr('stroke', 'black')
                    .attr('fill', "#FFFF64")

                axis.attr('visibility', 'visible');
            }
            if (res.index === 2 && res.direction === "down") {
                geniuses
                    .transition(trans())
                    .attr('fill', d => d.new ? "#FFFF64": "gray");
            }
            if (res.index === 3 && res.direction === "down") {
                sim.restart();

                geniuses = geniuses.data(combine)
                    .join(
                        enter => enter
                            .append('circle')
                            .call(enter => enter.transition(trans()).attr('r', 7))
                            .attr('class', 'genius')
                            .attr('fill', d => ("color" in d) ? d.color : 'lightgray')
                            .attr('stroke', 'black'),
                        update => update,
                        exit => exit.remove()
                    );

                sim.nodes(combine)
                sim.alpha(1).restart();

                set_mouse(geniuses);
            }
        })
        .onStepExit(res => {
            if (res.index === 0 && res.direction === "up") {
                not_genius
                    .transition(trans())
                    .attr('fill', fill_circle)
                    .attr('pointer-events', 'visiblePainted');

                genius
                    .transition(trans())
                    .attr('fill', "#FFFF64")
                    .attr('pointer-events', 'visiblePainted')
                    .attr('stroke-width', 0)
                    .attr('cx', 0)
            }
            if (res.index === 1 && res.direction === "up") {
                genius
                    .transition(trans())
                    .attr('fill', "#FFFF64")
                    .attr('pointer-events', 'none')
                    .attr('stroke-width', 1)
                    
                geniuses
                    .transition(trans())
                    .attr('r', 0)
                    .attr('stroke', 'transparent')
                    .attr('fill', "transparent")

                axis.attr('visibility', 'hidden');
            }
            if (res.index === 2 && res.direction === "up") {
                geniuses
                    .transition(trans())
                    .attr('fill', "#FFFF64");
            }
            if (res.index === 3 && res.direction === "up") {
                sim.restart();

                geniuses = geniuses.data(swarm_data)
                    .join(
                        enter => enter,
                        update => update,
                        exit => exit.remove()
                    );

                sim.nodes(swarm_data)
                sim.alpha(1).restart();

                set_mouse(geniuses);
            }
        })

    const cheight = 250 * 98;
    let cdata = await d3.json('./json/history.json');

    const lm = 50;

    let yScale = d3.scaleTime()
        .domain(d3.extent(cdata, d => time(d.time))).nice(d3.timeDay.every(1))
        .range([margin.top, cheight - margin.bottom]);

    let cal = d3.select('#calendar')
        .attr('viewBox', [0, 0, width, cheight])
        .attr('font-family', 'sans-serif')

    let dformat = d3.timeFormat('%b %d')

    cal.append('g')
        .attr('transform', `translate(0, 0)`)
        .call(d3
            .axisRight(yScale)
            .tickFormat((d, i) => (i % 4 === 0) ? dformat(d) : tformat(d))
            .ticks(d3.timeHour.every(6))
            .tickSize(width - margin.right)
            )
        .call(g => g.select('.domain').remove())
        .call(g => {
            g.selectAll('.tick line').filter(Number)
                .attr('stroke', '#c0c0c0')
                .attr('stroke-dasharray', '2,2')
            g.selectAll('.tick text')
                .attr('x', 0)
                .attr('dy', -5)
                .attr('font-weight', (d, i) => (i % 4 === 0) ? 'bold': 'normal')
                .attr('text-anchor', 'start')
        })

    cal.selectAll('circle')
        .data(cdata)
        .join('circle')
            .attr('r', 4)
            .attr('cx', d => (Math.random() * (width - lm - margin.right)) + lm)
            .attr('cy', d => yScale(time(d.time)))
            .attr('fill', d => d.color)

    let draw_line = y => {
        cal.append('line')
            .attr('y1', yScale(time(y)))
            .attr('y2', yScale(time(y)))
            .attr('x1', 0)
            .attr('x2', width - margin.right)
            .attr('fill', 'black')
            .attr('stroke', 'black')
            .attr('stroke-width', 2.5)
    }

    let draw_text = (y, text) => {
        cal.append('text')
            .attr('x', lm)
            .attr('y', yScale(time(y)))
            .attr('font-family', 'sans-serif')
            .attr('font-size', 11)
            .attr('font-weight', 'bold')
            .text(text)
            .call(wrap, width - margin.right - lm)
    }

    let draw_title = (t, d) => {
        draw_line(t)
        cal.append('text')
            .attr('x', lm)
            .attr('y', yScale(time(t)))
            .attr('dy', -5)
            .attr('font-family', 'sans-serif')
            .attr('font-size', 10)
            .attr('font-weight', 'bold')
            .text(d)
    }

    draw_title('2021-01-19 00:00:00', '400,000 COVID-19 deaths in the United States');
    draw_title('2021-02-22 06:00:00', '500,000 COVID-19 deaths in the United States');
    draw_title('2021-04-22 06:00:00', '569,875 COVID-19 deaths in the United States');
    draw_title('2021-04-20 18:00:00', 'Derek Chauvin is charged with murder.');
    draw_title('2021-02-24 00:00:00', 'Wellness day');
    draw_title('2021-03-16 18:00:00', 'Atlanta spa mass shootings');
    draw_title('2021-03-23 00:00:00', 'Wellness day');
    draw_title('2021-04-11 15:00:00', 'Killing of Daunte Wright');
    draw_title('2021-04-16 00:00:00', 'Indianapolis FedEx mass shooting');

    draw_line('2021-01-20 12:00:00')
    draw_text(
        '2021-01-20 10:30:00',
        "Sporadic Twitter checking through the day and night below because of Joe Biden's inauguration."
    )

    draw_line('2021-01-22 15:30:00')
    draw_text(
        '2021-01-22 12:30:00',
        "The gray circles directly below are from looking at documentation for WooCommerce, a WordPress extension used to sell products on online. I was researching as part of a tech consulting extracurricular."
    )

    draw_line('2021-01-23 13:00:00');
    draw_text(
        '2021-01-23 13:30:00',
        'This was the first weekend during which I spent time researching for The Michigan Daily data series on salaries and budget which I just released last Wednesday. The blue and yellow circles are Google searches and official U-M websites that I visited to try and categorize departments and staff members. If you see more of this blue and yellow pattern in the coming weeks, it was most likely more research for the series.'
    )

    draw_line('2021-01-29 12:00:00');
    draw_text(
        '2021-01-29 12:10:00',
        'More salary data series research during this weekend.'
    )

    draw_line('2021-02-03 21:55:00');
    draw_text(
        '2021-02-03 20:30:00',
        'Close Reading Genius song lyric research.'
    );

    draw_line('2021-02-10 01:00:00')
    draw_text(
        '2021-02-09 22:35:00',
        'The blue and gray circles below were from researching cost of living in Ann Arbor. The red circles after are from a YouTube break.'
    )

    draw_line('2021-03-03 15:30:00');
    draw_text(
        '2021-03-03 15:40:00',
        'The light blue circles above are from me refreshing Twitter over and over again to check on how the feeder schools series was doing on social media. It was my first major project for The Daily!'
    );

    draw_line('2021-03-06 07:00:00');
    draw_text(
        '2021-03-06 07:15:00',
        'Most of the blue circles here are from juggling between several Google Docs and Sheets in preparation for a meeting with reporters from The Daily news section to discuss writing stories for the salary data series.'
    );

    draw_line('2021-03-26 06:00:00')
    draw_text(
        '2021-03-26 06:30:00',
        'The dark blue and black circles above are me visiting GitHub and The Michigan Daily websites, updating data graphic drafts and previewing how they looked on the website.'
    )

    draw_line('2021-03-27 15:00:00');
    draw_text(
        '2021-03-27 15:30:00',
        'The blue line above is me visiting Piazza (a class forum we use for EECS 281) to find answers to technical questions for a project that was due on April 1st. March 27th was my first day starting on the project!'
        );

    draw_line('2021-04-16 00:00:00');
    draw_text(
        '2021-04-16 00:00:00',
        'The gray and blue circles above are from Google searches and visits for sites that contaiend data on Michigan law enforcement salaries. This data was used in the salary series in comparison to DPSS funding.'
    );

    draw_line('2021-04-18 03:00:00');
    draw_text(
        '2021-04-18 03:10:00',
        'The yellow and blue circles above are for another EECS 281 project! The due date was April 19th, two days after I started. The yellows are me submitting code for the projects to check for correctness, and the blues are me checking Piazza, the class forum.')

    draw_line('2021-04-21 04:00:00')
    draw_text(
        '2021-04-21 04:15:00',
        'The dark blue circles above are me visiting The Michigan Daily website repeatedly during the publication process for the salary series, making sure every detail in the stories was correct.'
    )

    draw_line('2021-04-23 22:15:00');
    draw_text(
        '2021-04-23 22:25:00',
        'EECS 281 Final! The block prior to this empty portion was all "studying."'
    )

    draw_line('2021-04-24 06:00:00');
    draw_text(
        '2021-04-24 06:25:00',
        'Immediately after finishing the final, I did a bunch of technical research for how to do all of the data visuals for this assignment.'
    )

    draw_head();
}