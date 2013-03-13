
var historicalData = new Meteor.Collection("history");

var setSimpleTemplateData = function(name) {
  Template[name].data = function () {
    return Session.get(name);
  };
  
  Meteor.call("getServiceData", name, function(err, data) {
    Session.set(name, JSON.parse(data));
  });
}

/**
 * 
 * Actual code starts
 * 
 */


if (Meteor.isClient) {
    Template.Tumblr.prettyTimeAgo = function() { return Session.get("Tumblr") && jQuery.timeago(new Date(Session.get("Tumblr").updated * 1000)); }
    setSimpleTemplateData("Tumblr");
    setSimpleTemplateData("Github");
    Template.Twitter.prettyTimeAgo = function() { return Session.get("Twitter") && jQuery.timeago(new Date(Session.get("Twitter").created_at)); };
    setSimpleTemplateData("Twitter");
    setSimpleTemplateData("Coderwall");
    setSimpleTemplateData("Foursquare");
    setSimpleTemplateData("LastFM");
    
    function plotSeries(series, containerID, options) {
        $(document).ready(function() {
            $.plot($("#" + containerID).show(), series, options);
        });
    }

    Template.Plots.events = {
        "click button#fsq": function() {
            //Plotting
            var fsqScores = {data: [], label: "Recent score", yaxis: 1};
            var fsqCheckins = {data: [], label: "Checkins", yaxis: 2};
            var fsqRecentCheckins = {data: [], label: "Recent checkins", yaxis: 1};
            
            if(!Session.get("Foursquare") || !$("#foursquare_chart").css("width")) return;
            fsqScores.data.length = 0;
            fsqCheckins.data.length = 0;
            historicalData.find().forEach(function(dataPoint) {
                fsqScores.data.push([dataPoint.timestamp, dataPoint.foursquare.user.scores.recent]);
                fsqCheckins.data.push([dataPoint.timestamp, dataPoint.foursquare.user.checkins.count]);
                fsqRecentCheckins.data.push([dataPoint.timestamp, dataPoint.foursquare.user.scores.checkinsCount]);
            });
            plotSeries([fsqScores, fsqCheckins, fsqRecentCheckins], "foursquare_chart", {
                yaxes: [{}, {position: "right"}],
                xaxes: [{mode: "time"}],
                legend: {position: "sw"}
            });
        },
        "click button#twitter": function() {
            //Plotting
            var followers = {data: [], label: "Followers", yaxis: 1};
            var friends = {data: [], label: "Friends", yaxis: 1};
            var tweets = {data: [], label: "Tweets", yaxis: 2};
            
            if(!Session.get("Twitter") || !$("#twitter_chart").css("width")) return;
            historicalData.find().forEach(function(dataPoint) {
                followers.data.push([dataPoint.timestamp, dataPoint.twitter.followers_count]);
                friends.data.push([dataPoint.timestamp, dataPoint.twitter.friends_count]);
                tweets.data.push([dataPoint.timestamp, dataPoint.twitter.statuses_count]);
            });
            plotSeries([followers, friends, tweets], "twitter_chart", {
                yaxes: [{}, {position: "right"}],
                xaxes: [{mode: "time"}],
                legend: {position: "sw"}
            });
        },
        
        
    };
}

var apis = {
    getBasicAPI: function(url) {
        return Meteor.http.get(url).data;
    },
    
    getTumblr: function() {
        return this.getBasicAPI("http://api.tumblr.com/v2/blog/ox86.tumblr.com/info?api_key=" + keys.tumblr).response.blog;
    },
    
    getGithub: function() {
        return this.getBasicAPI("https://api.github.com/users/avgp");
    },
    
    getFoursquare: function() {
        var data = {
            user: this.getBasicAPI("https://api.foursquare.com/v2/users/self?oauth_token=" + keys.foursquare).response.user
        };
        
        var badgesRaw = this.getBasicAPI("https://api.foursquare.com/v2/users/self/badges?oauth_token=" + keys.foursquare).response.badges;
        var badgeArr = [];
        Object.getOwnPropertyNames(badgesRaw).forEach(function(val, idx, array) {
            //Get only unlocked badges
            if(badgesRaw[val].unlocks.length > 0) {
                badgeArr.push(badgesRaw[val]);
            }
        });
        data.badges = badgeArr;
        
        return data;
    },
    
    getCoderwall:function() {
        return this.getBasicAPI("https://coderwall.com/martin-n.json");
    },
    
    getTwitter: function() {
        return this.getBasicAPI("https://api.twitter.com/1/users/show.json?screen_name=avgp");
    },
    
    getLastFM: function() {
        var data = {
            user: this.getBasicAPI("http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=avgp&api_key=" + keys.lastfm + "&format=json").user,
            topTracks: this.getBasicAPI("http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=avgp&api_key=" + keys.lastfm + "&format=json&limit=10").toptracks.track,
            weeklyTracks: this.getBasicAPI("http://ws.audioscrobbler.com/2.0/?method=user.getweeklytrackchart&user=avgp&api_key=" + keys.lastfm + "&format=json").weeklytrackchart.track
        };

        data.top10time = 0;
    
        for(var i=0; i<data.topTracks.length;i++) {
            if(!data.topTracks[i].image || !data.topTracks[i].image[0]) continue;
            data.topTracks[i].image = data.topTracks[i].image[0]["#text"];
            data.top10time += Math.round(parseInt(data.topTracks[i].duration, 10) / 60.0) * data.topTracks[i].playcount;
        }    
        data.top10time = (data.top10time / 60).toFixed(2);
    
        data.weeklyTime = 0;
        for(var i=0;i<data.weeklyTracks.length;i++) {
            data.weeklyTracks[i].artist.name = data.weeklyTracks[i].artist["#text"];
            if(!data.weeklyTracks[i].image || !data.weeklyTracks[i].image[0]) continue;
            data.weeklyTracks[i].image = data.weeklyTracks[i].image[0]["#text"];
            var trackDetails = this.getBasicAPI("http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=4ce0719aa2f0945baaa3ac120fe7d0bd&artist=" + data.weeklyTracks[i].artist.name + "&track=" + data.weeklyTracks[i].name + "&format=json").track;
            data.weeklyTracks[i].duration = ((trackDetails && trackDetails.duration) / 1000) || 0;
            data.weeklyTime += Math.round(parseInt(data.weeklyTracks[i].duration, 10) / 60.0) * data.weeklyTracks[i].playcount;                
        }
        data.weeklyTime = (data.weeklyTime / 60).toFixed(2);
        data.weeklyTracks.length = 10;
        
        return data;
    }
};

if (Meteor.isServer) {
  Meteor.methods({
    getServiceData: function(serviceName) {
      return JSON.stringify(apis["get" + serviceName]());
    }
  });
  
  var storeHistoricalData = function() {
      console.log("Saving historical data");
      var dataSet = {timestamp: new Date().getTime()};
      dataSet.coderwall     = apis.getCoderwall();
      dataSet.foursquare    = apis.getFoursquare();
      dataSet.github        = apis.getGithub();
      dataSet.lastfm        = apis.getLastFM();
      dataSet.tumblr        = apis.getTumblr();
      dataSet.twitter       = apis.getTwitter();
      historicalData.insert(dataSet);
      console.log("Done saving history");
      Meteor.setTimeout(storeHistoricalData, 3600000);
  }
  
  Meteor.startup(function () {
    Meteor.setTimeout(storeHistoricalData, 0);
  });
}
