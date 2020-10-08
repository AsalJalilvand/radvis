var attractors, datapoints;
var colour, colourRangeMin, colourRangeMax, lastColumnIsRegression, lastColumnName, categoricalColourDomain;
var svgContainer, height, width, radius, attractorNodes, attractorLabels, dataNodes, numOfSelectedAnchors, vizType;

//the overall idea of attractors and datapoints from:http://vda-lab.github.io/2014/02/radviz-rewrite-in-d3
function Attractor(name, angle, selected, minOfColumn, maxOfColumn) {
    this.name = name;
    this.angle = toRadians(angle);
    this.selected = selected;
    this.xCoordinate = Math.cos(this.angle) * radius;//initial values for (x,y), as the first plot is RadViz
    this.yCoordinate = Math.sin(this.angle) * radius;
    this.minOfColumn = minOfColumn;
    this.maxOfColumn = maxOfColumn;
    //unit vectors used for Star Coordinates
    this.unitVectorX = function () {
        return this.xCoordinate / (this.maxOfColumn - this.minOfColumn);
    };
    this.unitVectorY = function () {
        return this.yCoordinate / (this.maxOfColumn - this.minOfColumn);
    };

}

function toRadians(angle) {
    //https://gamedev.stackexchange.com/questions/128593/why-dont-javascript-math-cos-doesnt-match-this-vector-tutorial
    return (angle * Math.PI) / 180.0;
}

function toDegrees(radians) {
    return radians * (180 / Math.PI);
}

function DataPoint(attractions, quality) {
    this.attractions = attractions;
    this.quality = quality;
    this.xCoordinate = 0;
    this.yCoordinate = 0;
    this.getX = function () {
        //for RadViz, multiple xCoordinate(which is normalized) by radius to scale the point over circle
        return vizType === 1 ? this.xCoordinate * radius : this.xCoordinate;
    };
    this.getY = function () {
        return vizType === 1 ? this.yCoordinate * radius : this.yCoordinate;
    };
    calculateDatapointCoordinates(this);
}

function calculateDatapointCoordinates(datapoint) {
    var newX = 0, newY = 0;
    if (vizType === 1) { //RadViz
        //formulas found on https://ieeexplore.ieee.org/document/5190784 section 2.1
        var sumOfAttractionForceCos = 0;
        var sumOfAttractionForceSin = 0;
        var sumOfAllDimentions = 0;
        for (var i = 0; i < datapoint.attractions.length; i++) {
            if (datapoint.attractions[i].attractor.selected) { //only calculate if the user wants to see the anchor
                sumOfAttractionForceCos += datapoint.attractions[i].normalizedForce * Math.cos((datapoint.attractions[i].attractor.angle));
                sumOfAttractionForceSin += datapoint.attractions[i].normalizedForce * Math.sin((datapoint.attractions[i].attractor.angle));
                sumOfAllDimentions += datapoint.attractions[i].normalizedForce;
            }
        }
        newX = sumOfAttractionForceCos / sumOfAllDimentions;
        newY = sumOfAttractionForceSin / sumOfAllDimentions;
    } else if (vizType === 2) { //Star Coordinates, formulas found on https://dl.acm.org/citation.cfm?id=502530
        for (var i = 0; i < datapoint.attractions.length; i++) {
            if (datapoint.attractions[i].attractor.selected) { //only calculate if the user wants to see the anchor
                newX += datapoint.attractions[i].attractor.unitVectorX() * (datapoint.attractions[i].force -
                    (datapoint.attractions[i].attractor.minOfColumn));
                newY += datapoint.attractions[i].attractor.unitVectorY() * (datapoint.attractions[i].force -
                    (datapoint.attractions[i].attractor.minOfColumn));
            }
        }
    }
    datapoint.xCoordinate = newX;
    datapoint.yCoordinate = newY;
}

function recalculateAnchorAngleAndPosition() {
    var counter = 0;
    for (var i = 0; i < attractors.length; i++) {
        if (attractors[i].selected) {
            attractors[i].angle = toRadians((360 / numOfSelectedAnchors) * counter);
            attractors[i].xCoordinate = Math.cos(attractors[i].angle) * radius;
            attractors[i].yCoordinate = Math.sin(attractors[i].angle) * radius;
            counter++;
        }
    }
}

function initializePanelProperties() {
    width = 800;
    height = 600;
    radius = Math.min(width, height) / 2 - 80;
}

function initializeDatapoints(dataset, normalizedDataset) {
    datapoints = [];
    for (var i = 0; i < dataset.length; i++) {
        var attractions = [];
        for (var j = 0; j < attractors.length; j++) {
            attractions.push({
                attractor: attractors[j], force: dataset[i][attractors[j].name],
                normalizedForce: normalizedDataset[i][attractors[j].name]
            });
        }
        datapoints.push(new DataPoint(attractions, dataset[i][lastColumnName]))
    }
    normalizedDataset = null;//no need to save it anymore, save memory space
}

function drawVisualization() {
    //create main panel
    d3.select("svg.main").remove(); //remove previous svgs created before (in case new file is chosen)
    svgContainer = d3.select("#svgContainer").append("svg")
        .attr("class", "main")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");
    //create a circular axis if the visualization type is RadViz
    if (vizType === 1) {
        svgContainer.append('circle')
            .attr('class', 'panel')
            .style('stroke', "black")
            .style('stroke-width', 3)
            .style('fill', 'transparent')
            .attr('r', radius);
    }
    createElementsOnPanel();
    setUpSlider();
    createCheckboxes();
}

function getLabelY(y, angleDegree) {
    //if the anchor point is situated around 90 degrees or 270 degrees, move its label slightly so that they won't
    //be drawn on each other
    var labelY = y;
    if (angleDegree > 250 && angleDegree < 300)
        labelY -= 15;
    else if (angleDegree > 70 && angleDegree < 120)
        labelY += 15;
    return labelY;
}

function createElementsOnPanel() {
    //Attractor points. Source: Source:https://bl.ocks.org/mbostock/4583749,
    // https://github.com/WYanChao/RadViz/blob/master/src/RadViz.js
    //first remove previous elements (in case new file/visualization type is selected)
    svgContainer.selectAll('circle.attractors').remove();
    svgContainer.selectAll('line.attractors').remove();
    if (vizType === 1) { //RadViz, circular anchors
        attractorNodes = svgContainer.append("g")
            .selectAll("g")
            .data(attractors.filter(function (d) {
                return d.selected === true;
            }))
            .enter().append("g").append("circle")
            .attr('class', 'attractors')
            .attr('r', 6)
            .attr('cx', d => d.xCoordinate)
            .attr('cy', d => d.yCoordinate)
            .style('fill', "black");
    } else if (vizType === 2) { //Star Coordinate, linear anchors
        attractorNodes = svgContainer.append("g")
            .selectAll("g")
            .data(attractors.filter(function (d) {
                return d.selected === true;
            }))
            .enter().append("g").append("line")
            .attr('class', 'attractors')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', d => d.xCoordinate)
            .attr('y2', d => d.yCoordinate)
            .attr("stroke-width", 4)
            .attr("stroke", "black");
    }
    attractorNodes.call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    //Attractor labels***************************************************
    svgContainer.selectAll('text.attractors').remove();
    attractorLabels = svgContainer.append("g")
        .selectAll("g")
        .data(attractors.filter(function (d) {
            return d.selected === true;
        }))
        .enter().append("g")
        .append("text")
        .attr('class', 'attractors')
        .attr("x", function (d) {
            var angleDegree = toDegrees(d.angle);
            return angleDegree > 270 || angleDegree < 90 ? d.xCoordinate + 10 : d.xCoordinate - 10;
        })
        .attr("y", function (d) {
            var angleDegree = toDegrees(d.angle);
            return getLabelY(d.yCoordinate, angleDegree);
        })
        .style("text-anchor", function (d) {
            var angleDegree = toDegrees(d.angle);
            return angleDegree < 270 && angleDegree > 90 ? "end" : "start";
        })
        .text(function (d) {
            return d.name;
        });
    //Draw data points**********************************************************
    svgContainer.selectAll('circle.datapoints').remove();
    dataNodes = svgContainer.append("g")
        .selectAll("g")
        .data(datapoints)
        .enter().append("g")
        .append("circle")
        .attr("class", "datapoints")
        .attr("cx", function (d) {
            return d.getX();
        })
        .attr("cy", function (d) {
            return d.getY()
        })
        .attr("r", 6)
        .style("fill", function (d) {
            return colour(d.quality);
        })
        .style("stroke", "black")
        .on("mouseover", function (d) {
            viewDatapointTooltip(d)
        })
        .on("mouseout", function () {
            d3.select("#tooltip").style("visibility", "hidden");
        });
}

function drawAttractorsAndDatapoints() {
    //update attractor nodes
    attractorNodes.data(attractors.filter(function (d) {
        return d.selected === true;
    }));
    if (vizType === 1)  //RadViz, anchor are represented as small circles
        attractorNodes.attr('cx', d => d.xCoordinate)
            .attr('cy', d => d.yCoordinate);
    else if (vizType === 2) //Star Coordinates, anchors are lines
        attractorNodes.attr('x2', d => d.xCoordinate)
            .attr('y2', d => d.yCoordinate);
    //update attractor labels
    attractorLabels.data(attractors.filter(function (d) {
        return d.selected === true;
    }))
        .attr("x", function (d) {
            var angleDegree = toDegrees(d.angle);
            return angleDegree > 270 || angleDegree < 90 ? d.xCoordinate + 10 : d.xCoordinate - 10;
        })
        .attr("y", function (d) {
            var angleDegree = toDegrees(d.angle);
            return getLabelY(d.yCoordinate, angleDegree);
        })
        .style("text-anchor", function (d) {
            var angleDegree = toDegrees(d.angle);
            return angleDegree < 270 && angleDegree > 90 ? "end" : "start";
        });
    //update datapoint nodes
    dataNodes.data(datapoints)
        .attr("cx", function (d) {
            return d.getX();
        })
        .attr("cy", function (d) {
            return d.getY();
        });
}

function dragstarted(d) {
    d3.select(this).raise().classed('active', true);
}

function dragended(d) {
    d3.select(this).classed('active', false);
}

function dragged(d, i) {
    d3.select(this).raise().classed('active', true);
    var newX = d3.event.x;
    var newY = d3.event.y;
    d.angle = Math.atan2(newY, newX); //new angle based on new x and y, in radian
    if (vizType === 1) { //RadViz
        d.xCoordinate = Math.cos(d.angle) * radius;
        d.yCoordinate = Math.sin(d.angle) * radius;
    } else if (vizType === 2) { //Star Coordinates
        d.xCoordinate = newX;
        d.yCoordinate = newY;
    }
    //new position of the anchors affects data points, so recalculate their position
    for (var point = 0; point < datapoints.length; point++) {
        calculateDatapointCoordinates(datapoints[point])
    }
    drawAttractorsAndDatapoints();
}


function setUpSlider() {
    //color opacity slider.Source:https://bl.ocks.org/EfratVil/2bcc4bf35e28ae789de238926ee1ef05
    d3.select("#slider").on("input", function () {
        svgContainer.selectAll("circle.datapoints")
            .transition()
            .duration(1000)
            .ease(d3.easeLinear)
            .style("opacity", d3.select("#slider").property("value") / 100);
    });
}

function setColors(colorType) {
    //Source:https://www.d3-graph-gallery.com/graph/custom_color.html
    if (lastColumnIsRegression) {
        switch (colorType) {
            case  "0":
                colour = d3.scaleSequential().domain([colourRangeMin, colourRangeMax])
                    .interpolator(d3.interpolateRainbow);
                break;
            case  "1":
                colour = d3.scaleSequential().domain([colourRangeMin, colourRangeMax])
                    .interpolator(d3.interpolateBuGn);
                break;
            case  "2":
                colour = d3.scaleSequential().domain([colourRangeMin, colourRangeMax])
                    .interpolator(d3.interpolatePuRd);
                break;
        }
    } else {
        categoricalColourDomain = new Set();
        //get all the available class names in dataset,store in set to only keep unique ones
        for (var i = 0; i < datapoints.length; i++) {
            categoricalColourDomain.add(datapoints[i].quality);
        }
        switch (colorType) {
            case  "0":
                colour = d3.scaleOrdinal().domain(categoricalColourDomain).range(d3.schemeAccent);
                break;
        }
    }
    displayColorScaleLegend();
}

function displayColorScaleLegend() {
    d3.select("#colorLegend").selectAll('*').remove();//remove legend from previous color choice
    var colorLegend = d3.select("#colorLegend")
        .append("svg")
        .attr("width", 420)
        .attr("height", 60);
    if (lastColumnIsRegression) {
        //https://developer.mozilla.org/en-US/docs/Web/SVG/Element/stop
        colorLegend.append("g");
        gradient = colorLegend.append('defs')
            .append('linearGradient')
            .attr('id', 'gradient');
        //divide color range in five sections and show them in legend
        for (var i = 0; i < 5; i++) {
            var colorInput = ((colourRangeMax - colourRangeMin) / 5 * i) + parseFloat(colourRangeMin);
            gradient.append('stop')
                .attr('offset', i * 20 + "%")
                .attr('stop-color', colour(colorInput));
        }
        colorLegend
            .append('rect')
            .attr('width', 400)
            .attr('height', 50)
            .attr("transform", "translate(10,0)")//without transform, the first number of the axis is not fully visible
            .style('fill', 'url("#gradient")');
        //make a scale for color range, spread them across the 400px rectangle
        //https://www.d3-graph-gallery.com/graph/custom_axis.html
        var scale = d3.scaleLinear().domain([colourRangeMin, colourRangeMax]).range([0, 400]);
        colorLegend.append('g')
            .attr("transform", "translate(10,0)")//without transform, the first number of the axis is not fully visible
            .call(d3.axisBottom(scale));
    } else {//color is categorical, for each category make a circle with its color and class name
        colorLegend.selectAll("circle")
            .data(Array.from(categoricalColourDomain))
            .join("circle")
            .attr("cx", function (d, i) {
                return 50 + i * 100
            })
            .attr("cy", 10)
            .attr("r", 10)
            .style("fill", function (d) {
                return colour(d)
            })
            .attr("transform", "translate(50,10)");
        colorLegend.selectAll("text").data(Array.from(categoricalColourDomain))
            .join("text")
            .attr("x", function (d, i) {
                return 50 + i * 100; //if the number of categories are more than a certain number, they may not be
            }).attr("y", 40).text(d => d);// fitted in colorLegend svg as it's 400px wide
    }
}


function createMenu() {
    //clear menu before appending new options (in case new file is selected)
    //https://stackoverflow.com/questions/4618763/removing-all-option-of-dropdown-box-in-javascript
    document.getElementById('menu-color').options.length = 0;
    //create a new menu for color options
    //Source:https://github.com/MateusMP/D3ScatterPlot
    var colorScales;
    if (lastColumnIsRegression)
        colorScales = ["Rainbow", "Green", "Pink"];
    else
        colorScales = ["Categorical"];
    var menuColor = d3.select("#menu-color");

    // Options for color
    colorScales.forEach((color, i) => {
        menuColor.append("option").attr("value", i).text(color);
    });

    // Default selected option
    menuColor.node().value = 0;

    menuColor.on('change', function () {
        setColors(menuColor.node().value);
        recolourNodes();
    });
}

function recolourNodes() {
    svgContainer.selectAll('circle.datapoints')
        .transition()
        .duration(500)
        .ease(d3.easeLinear)
        .style("fill", function (d) {
            return colour(d.quality);
        });
}

function fillDatasetAndDraw(csvFile) {
    initializePanelProperties();
    d3.csv(csvFile).then(function (data) {
        attractors = [];
        numOfSelectedAnchors = data.columns.length - 1;
        //RadViz requires normalized data, so while reading columns, we'll make a normalized dataset simultaneously
        //we'll keep a "force" and a "normalizedForce" for each datapoint's attraction
        var min, max;
        var normalizedData = [];
        for (var i = 0; i < data.length; i++) {
            normalizedData.push(new Object());
        }
        for (var i = 0; i < data.columns.length; i++) {
            var thisColumn = data.columns[i];
            if (i < (data.columns.length - 1)) {
                //change from string to number
                data.forEach(function (d) {
                    d[thisColumn] = +d[thisColumn];
                });
            }
            //get min and max for the normalization
            max = d3.max(data, function (d) {
                return d[thisColumn];
            });
            min = d3.min(data, function (d) {
                return d[thisColumn];
            });

            if (i === (data.columns.length - 1)) //last column defines regression or class
            {
                data.forEach(function (d) {
                    if (isNaN(+d[thisColumn])) {
                        lastColumnIsRegression = false;
                    } else {
                        lastColumnIsRegression = true;
                        colourRangeMax = max;
                        colourRangeMin = min;
                    }
                });
                lastColumnName = thisColumn;
                break; //no need to normalize last column
            }
            //build attractors here, instead of a separate function, so as to calculate min and max once
            attractors.push(new Attractor(thisColumn, (360 / numOfSelectedAnchors) * i, true, min, max));
            var range = max - min;
            data.forEach(function (d, row) {
                normalizedData[row][thisColumn] = ((d[thisColumn] - min) / range);
            });
        }
        initializeDatapoints(data, normalizedData);
        setColors("0");
        createMenu();
        drawVisualization();
        displayColorScaleLegend();
    });
}

function viewDatapointTooltip(datapoint) {
    //https://bl.ocks.org/d3indepth/e890d5ad36af3d949f275e35b41a99d6
    if (datapoint == null)
        return;
    var barWidth = 200;
    var barScale = d3.scaleLinear().domain([0, 1]).range([0, barWidth]);
    var u = d3.select('#tooltip')
        .style("visibility", "visible")
        .selectAll('.force')
        .data(datapoint.attractions, function (d) {
            return d.attractor.name;
        });
    var entering = u.enter()
        .append('div')
        .classed('force', true);
    entering.append('div')
        .classed('label', true)
        .text(function (d) {
            return d.attractor.name;
        });

    entering.append('div')
        .classed('bar', true);
    entering
        .merge(u)
        .select('.bar')
        .transition()
        .style('width', function (d) {
            return barScale(d.normalizedForce) + 'px';
        }).text(function (d) {
        return d.normalizedForce.toFixed(2);
    });

    u.exit().remove();
}

function createCheckboxes() {
    //clear previous checkboxes (in case new file is selected)
    //https://stackoverflow.com/questions/3450593/how-do-i-clear-the-content-of-a-div-using-javascript
    var checkboxDiv = document.getElementById('anchorCheckbox');
    while (checkboxDiv.firstChild) {
        checkboxDiv.removeChild(checkboxDiv.firstChild);
    }
    //add new checkboxes
    for (var i = 0; i < attractors.length; i++) {
        d3.select("#anchorCheckbox")
            .append('label')
            .text(attractors[i].name)
            .append('input')
            .attr('type', 'checkbox')
            .property('checked', true)
            .property('id', attractors[i].name.replace(/\s+/g, '').replace(/[()]/g, ''))
            .on("click", function () {
                var numOfSelected = 0;
                for (var j = 0; j < attractors.length; j++) {
                    var checked = d3.select("#" + attractors[j].name.replace(/\s+/g, '').replace(/[()]/g, '')).property("checked");
                    attractors[j].selected = checked;
                    if (checked) {
                        numOfSelected++;
                    }
                }
                if (attractors.filter(function (d) {
                    return d.selected === true;
                }).length <= 1) {
                    window.alert("Please select at least two anchors!");
                    return;
                }
                numOfSelectedAnchors = numOfSelected;
                recalculateAnchorAngleAndPosition();
                for (var point = 0; point < datapoints.length; point++) {
                    calculateDatapointCoordinates(datapoints[point])
                }
                createElementsOnPanel();
            });
    }
}

function reset() {
    //reset menu options
    setColors("0");
    d3.select("#menu-color").node().value = 0;
    d3.select("#range1").property("value", 0);
    d3.select("#slider").property("value", 100);
    //reset nodes' attributes
    recolourNodes();
    numOfSelectedAnchors = attractors.length;
    for (var i = 0; i < attractors.length; i++) {
        attractors[i].selected = true;
        attractors[i].angle = toRadians((360 / numOfSelectedAnchors) * i);
        attractors[i].xCoordinate = Math.cos(attractors[i].angle) * radius;
        attractors[i].yCoordinate = Math.sin(attractors[i].angle) * radius;
        d3.select("#" + attractors[i].name.replace(/\s+/g, '').replace(/[()]/g, '')).property("checked", true);
    }
    for (var point = 0; point < datapoints.length; point++) {
        calculateDatapointCoordinates(datapoints[point]);
    }
    //redraw
    drawVisualization();
}

document.addEventListener("DOMContentLoaded", function (event) {
    vizType = 1; //1=>RadViz, 2=>Star Coordinates
    fillDatasetAndDraw('winequality-red.csv');
});


//reset button
window.onload = function () {
    //initial value of visualization type button
    vizTypeButton = document.getElementById('visualizationType');
    vizTypeButton.innerText = "Star Coordinates";
    //listener for switching between visualization types
    vizTypeButton.addEventListener("click", function (event) {
        if (vizType === 1) {
            vizType = 2; //change visualization type to Star Coordinates
            document.getElementById('visualizationType').innerText = "RadViz";
        } else {
            vizType = 1; //change visualization type to RadViz
            document.getElementById('visualizationType').innerText = "Star Coordinate";
        }
        reset();
    });
    //set listener for reset button
    document.getElementById("reset").addEventListener("click", function (event) {
        reset();
    });

    //set listener for datasets
    datasets = {'iris': 'iris.csv', 'white': 'winequality-white.csv', 'red': 'winequality-red.csv'};
    document.getElementById('datasets').addEventListener("change", function () {
        d = this.value;
        fillDatasetAndDraw(datasets[d]);
    });

};



