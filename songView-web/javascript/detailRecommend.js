var URL_ECHONEST_API = "http://developer.echonest.com/api/v4/";
var API_KEY= 'WMROE86FA97XXFS4I';
var msnry; 

//load the track info if present
function getUrlVars()
{
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
        
        
        
    }
    return vars;
}

function getPlaylistSong( songId, okAction, errorAction ){
	var responseS = null;
	$.getJSON(URL_ECHONEST_API + 'playlist/basic' + '?format=json&api_key='+API_KEY+'&song_id='+songId+'&type=song-radio&bucket=tracks&bucket=id:spotify&results=13', 
	{}, 
	function(r) {					
	if( r.response.status.code == 0 ){
		okAction.call(this, r);						
	}else{
		errorAction.call(this);
	}
					
	});
}

window.onload= ( function(){
	var urlVars = getUrlVars();
	
	console.log(urlVars);
	if( urlVars["idSong"] ){
		
		console.log( urlVars["idSong"] );
		//$('#containerDetailTrack').append('p').text(decodeURI(urlVars['artist'])+" - "+ decodeURI(urlVars['title']));
		getTrackVol(urlVars["idSong"], "#detailTrack");
		
		getPlaylistSong(urlVars["sid"], function(resp){ 
			
			
			
			$('#recommendationLoading').show();
			
			var response = resp.response;
			var songs = response.songs;
			
			//RECOMMENDATION
			songs.reverse();
			
			songs.pop();//Discard first element (Same artist)
			
			if ( songs.length > 0  ) {
				
				$.each(songs, function( idx, obj ){
					var tracks = obj.tracks;
					if(tracks.length > 0){
						var track = tracks[0];
						
						
							
							getTrackVol(track.id, '#recommendationsContainer');
						
						
						
						
					}
				});
			}
			
			
			
		},function(e){ console.log(e);});
	}else{
		alert('No ID specified');
	}
	
	var container = document.querySelector('#recommendationsContainer');
 	msnry = new Masonry( container, {
 	  // options
 	  columnWidth: 200,
 	  itemSelector: '.track'
 	});
});




function getTrackVol(trackId, targetId){

    var trackID = trackId;

    console.log('Load');
    $('#detailTrackLoading').show();
    // request the track analysis
    $.getJSON(URL_ECHONEST_API + 'track/profile' + '?format=json&api_key='+API_KEY+'&id='+trackID+"&bucket=audio_summary",   
        function(data) {

            // analysis returned to URL. Now we need to get the full detailed data
            analysisUrl = data.response.track.audio_summary.analysis_url;
            $.getJSON(analysisUrl,
                function(songData){
                    // generate visualization using full analysis data
                    generateSongView(data.response.track, songData, targetId);
                    $('#detailTrackLoading').hide();
                    $('#recommendationLoading').hide();
                    
                    msnry.reloadItems();
                    msnry.layout();
                });      
            
            
           
        });
}

var trackCounter = 0
function generateSongView(trackInfo, trackData, targetId){

    // adding track Update Counter
    trackCounter++;

    var tMax = [58.175, 318.591, 227.208]
    var tMin = [0, -308.285, -186.254]

    //SVG Width and height
    var w = 600;//Recommended 600
    var h = 47;
    var sidePadding = 10;
    var bottomPadding = 5;

    //Individual Pitch Box Dimensions
    var rectW = 2.5; // Makes graph bigger
    var rectH = 2.5; // Makes graph bigger
    var horPitchPadding = 0;  // Horizontal Padding
    var vertPitchPadding = 1;


    // Loudness Dimensions (uses width of Pitch boxes)
    var loudnessPadding = 0;
    var loudnessMaxH = 12;

    // Loudness scale to convert Echonest Loudness values to Height
    var loudnessMin = -60;
    var loudnessMax = 0;
    var loudnessScale = d3.scale.linear()
                            .domain([loudnessMin, loudnessMax])
                            .range([0, loudnessMaxH]);

    // var hueScale = d3.scale.linear()
    //                     .domain([0, 360])
    //                     .range([0,360]);

    var rgbScale = d3.scale.linear()
                        .domain([0,1])
                        .range([0,255]);

    var colorScale = d3.scale.quantize()
                        .domain([.15, .85])
                        .range(colorbrewer.YlGnBu[81]);

    var transparencyScale = d3.scale.pow().exponent(1.25)

    var darkerScale = d3.scale.linear()
                            .domain([0,1])
                            .range([1, 3]);

    var brighterScale = d3.scale.linear()
                            .domain([0,.7])
                            .range([0,5]);


    // Create DIV to store Song Info and SVG
    // including trackCounter to account for the same track being shown more than Once

    
    
    $('<div/>', {
        id: trackInfo.id + trackCounter + "",
        class: "track",
        
    }).appendTo(targetId);

   
    
    $("<h5>" + trackInfo.title + "</h5><h6>" + trackInfo.artist + "</h6>").appendTo("#" + trackInfo.id + trackCounter)

    //Create SVG element for drawing an individual SongVis
    var svg = d3.select("#" + trackInfo.id + trackCounter)
                .append("svg")
                .attr("width", w)
                .attr("height", h);


    // svg.append("rect")
    //     .attr("width", "100%")
    //     .attr("height", "100%")
    //     .attr("fill", d3.rgb(255,245, 245));

    // initialize counter and accumulators to 0
    var barIdx = 0;
    var barBreaks = 0;
    var segIdx= 0
    var numSegments = 0;
    var pitchTots = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    var loudnessTot = 0
    var timbreTots = [0, 0, 0]

    var movingX = sidePadding
    var barScaleFactor = 1.3

    // for(; barIdx<trackData.bars.length; segIdx++){      // For all bars
    for(; segIdx<trackData.segments.length && barIdx<trackData.bars.length; segIdx++){  

        // Get necessary data
        bar = trackData.bars[barIdx];
        barEndTime = bar.start + bar.duration;
        segment = trackData.segments[segIdx];

        if (segment.start < barEndTime){
            // if next segment is within current bar
            // summarize the data

            for(var i=0;i<12;i++){  //update pitch totals for all 12 pitches
                pitchTots[i]+= transparencyScale( segment.pitches[i] )
            }
            loudnessTot += (segment.loudness_start + segment.loudness_max) / 2;  // get average loudness per segment
            timbreTots[0] += segment.timbre[0];
            timbreTots[1] += segment.timbre[1];
            timbreTots[2] += segment.timbre[2];
            numSegments +=1;
        }
        else{

            // add vertical padding for every 4 bars
            var barSpace = 0
            if (barIdx%16 === 0 && barIdx !=0){
                barSpace = 1;
            }

            pitchAvg = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            timbreAvg = [0, 0, 0]
            //generate averages of data
            for(var i=0;i<12;i++){
                pitchAvg[i] = pitchTots[i] / numSegments;
                pitchTots[i] = 0;  // done with value reset to 0
            }

            loudnessAvg = loudnessTot / numSegments;
            loudnessTot = 0  // done with total loud so reset it

            timbreAvg[0] = timbreTots[0] / numSegments;
            timbreAvg[1] = timbreTots[1] / numSegments;
            timbreAvg[2] = timbreTots[2] / numSegments;

            // done with timbre tots reset to 0
            timbreTots[0] = 0;
            timbreTots[1] = 0;
            timbreTots[2] = 0;

            numSegments = 0; // done with summarization reset numSegments
            barIdx += 1;     // and update bar idx


            // Normalize timbre values to convert to values for color
            var rgbVals =  [0, 0, 0];
            for (var i=0; i<3; i++){
                t = timbreAvg[i];
                tNorm = (t - tMin[i]) / (tMax[i] - tMin[i])                
                rgbVals[i] = tNorm
            }

            // Now Draw the 12 boxes representing pitch
            svg.selectAll("rect"+barIdx)
                .data(pitchAvg)
                .enter()
                .append("rect")
                .attr("x", function(d){
                    return movingX + barSpace
                    // return sidePadding + ((barIdx-1) * rectW) + (barBreaks * vertPitchPadding);
                })
                .attr("y", function(d,i){
                    return h - bottomPadding - (i * (rectH + horPitchPadding));
                })
                .attr("width", (bar.duration * barScaleFactor))
                .attr("height", rectH)
                .attr("fill", function(d){

                    var color = colorScale((.15 * rgbVals[0] + .55 * rgbVals[1] + .30 * rgbVals[2]));
                    var colorHSL = d3.hsl(color);

                    return colorHSL.darker(.5);

                })
                .attr("fill-opacity", function(d){
                    return d;
                });

            // Draw the box representing loudness
            svg.selectAll("loudRect"+barIdx)
                .data([loudnessAvg])
                .enter()
                .append("rect")
                .attr("x", function(d){
                    return movingX + barSpace
                    // return sidePadding + ((barIdx-1) * rectW) + (barBreaks * vertPitchPadding);
                })
                .attr("y", function(d){
                    height = loudnessScale(d);
                    return h - bottomPadding - (11 * (rectH + horPitchPadding) - loudnessPadding) - height;
                })
                .attr("width", (bar.duration * barScaleFactor))
                .attr("height", function(d){
                    return loudnessScale(d);
                })
                .attr("fill", function(d){
                    var color = colorScale((.15 * rgbVals[0] + .55 * rgbVals[1] + .30 * rgbVals[2]));
                    var colorHSL = d3.hsl(color);

                    return colorHSL.darker(.5)
                })
                .attr("fill-opacity", .8);

            movingX += (bar.duration * barScaleFactor) + barSpace



            // lineY = h - bottomPadding - (13 * (rectH + pitchPadding) - loudnessPadding) - loudnessMaxH
            // svg.append("line")
            //     .attr("x1", sidePadding)
            //     .attr("y1", lineY)
            //     .attr("x2", trackData.bars.length * rectW + sidePadding)
            //     .attr("y2", lineY)
            //     .attr("stroke", function(d){
            //         return d3.rgb(150, 150, 150);
            //     });

            // Done drawing boxes now store segment info for next bar...
            for(var i=0;i<12;i++){  //update pitch totals for all 12 pitches
                pitchTots[i]+= transparencyScale( segment.pitches[i] )
            }
            loudnessTot += (segment.loudness_start + segment.loudness_max) / 2;  // get average loudness per segment
            timbreTots[0] += segment.timbre[0];
            timbreTots[1] += segment.timbre[1];
            timbreTots[2] += segment.timbre[2];
            numSegments +=1;
        }
    }
}


