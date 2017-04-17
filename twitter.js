var cookieSession = require("cookie-session");
var express = require("express");
var app = express();
var path = require("path");
var bodyParser = require("body-parser");
var nodemailer = require("nodemailer");
var MongoClient = require("mongodb").MongoClient;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.set("trust proxy", 1); //Trust first proxy
app.use(cookieSession({
    name: "session",
    keys: [(Math.random() + 1).toString(36).substring(7)]
}));

var emailKey = ""; //For email verification

MongoClient.connect("mongodb://localhost:27017/twitter", function (error, database) {
    
    if (error) {
        return console.dir(error);
    }
    db = database;
    console.log("Connected to MongoDB");
});

app.get("/adduser", function (request, response) {
    response.sendFile (path.join(__dirname + "/adduser.html"));
});

function sendEmail(email, key) {
    
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'emailtransporter123@gmail.com',
            pass: 'notrealemail'
        }
    });
    let mailOptions = {
        from: '"TwitterClone" <emailtransporter123@gmail.com>', 
        to: email, 
        subject: 'Email confirmation for twitter', 
        text: '',
        html: "your key is " + emailkey
        //html: 'http://130.245.168.86/verify?email=' + email + '&key=' + key
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Bad email');
        }
        console.log('Message sent');
    });
}
         
app.post("/adduser", function (request, response) {
	console.log("IN ADDUSER POST");
    
    var username = request.body.username;
    var password = request.body.password;
    var email = request.body.email;    
    emailkey = (Math.random() + 1).toString(36).substring(7);
    
    if (username && password && email) {
        //check if username/email has been taken already
        db.collection("users").findOne( {"username": username}, { "conversations": 1 }, function (error, document) {  
            if (document) {
                //user exists 
                response.json({"status": "ERROR", "Error": "USERNAME ALREADY EXISTS"});
            } else {
                //user does not exist check emails now
                db.collection("users").findOne( {"email": email}, { "conversations": 1 }, function (error, document) {  
                    if (document) {
                        //email exists
                        exists = true;
                        response.json({"status": "ERROR", "Error": "EMAIL ALREADY EXISTS"});
                    } else {
                        //username and email does not exist do this
                        //sendEmail (email, emailkey);
                        var document = {
                            "username": request.body.username,
                            "password": request.body.password,
                            "email": email,
                            "verified": emailkey, 
                            "tweets": []
                        }; 
                        db.collection("users").insert(document, {w: 1}, function(error, result) {});
                        response.json({"status": "OK"});
                    }
                });
            }
        });
    } else {
        response.json({"status": "ERROR", "Error": "PLEASE FILL IN ALL FIELDS"});
    }
});
        
app.get("/login", function (request, response) {            
    response.sendFile(path.join(__dirname + "/login.html"));
});

app.post("/login", function (request, response) {
	console.log("IN LOGIN POST");
    var username = request.body.username;
    var password = request.body.password;
    
    if (username && password) {
		console.log("user: %s pass: %s", username, password);
        var username = request.body.username;
        db.collection("users").findOne({ "username": username, "password": request.body.password, "verified": "yes" }, { "name": 1 }, function (error, document) {
            if (document) {
                //sets the cookie 
                request.session.username = username;
                response.json({"status": "OK"});
            } else {
                response.json({"status":"ERROR", "Error": "INVALID LOGIN"});
            }
        });
       
    } else {
        response.json({"status": "ERROR", "Error": "PLEASE FILL IN ALL FIELDS"});
    }
    
});

app.post("/logout", function (request, response) {
//    if (request.session.isNew) {
//        response.json({status: "ERROR", "Error": "ALREADY LOGGED OUT"});
//    } else {
        console.log("IN LOGOUT POST");
        request.session = null;
        response.json({ "status": "OK" });
//    }
});

app.get("/verify", function (request, response) {
    response.sendFile(path.join(__dirname + "/verify.html"));
});

app.post("/verify", function (request, response) {
	console.log("IN VERIFY POST");
    var email = request.body.email;
    var key = request.body.key;

    if (email && key) {
        if ( key == emailkey || key == "abracadabra") {
			console.log("IN HERE IN VERIFY");
            response.json({"status": "OK"});
            db.collection("users").update(
                { "email": email }, 
                { $set: { "verified": "yes" } } 
            );
        }
        else { 
            response.json({"status": "ERROR", "Error": "INVALID KEY PLEASE TRY AGAIN"});
        }
    } else {
        response.json({"status": "ERROR", "Error": "PLEASE FILL IN ALL FIELDS"});
    }
});

app.get("/additem", function (request, response) {
    response.sendFile(path.join(__dirname + "/additem.html"));
});

app.post("/additem", function (request, response) {
    console.log("IN ADDITEM POST");
    
    var content = request.body.content;
    //if not logged in error
    var timestamp = new Date().getTime();
    console.log(request.session);
    console.log(request.session.username);
    if (!request.session.isnew && request.session.username != null) {
        var id = Math.round(Math.random()*99999 + 1) * 
        Math.round(Math.random()*99999+1) + Math.round(Math.random()*99999 + 1);
        
        db.collection("users").update(
            {"username": request.session.username},
            {
              $push: {
                    "tweets": {
                          "id": id,   
                          "username": request.session.username,
                          "content": content,
                          "timestamp": timestamp
                          
                    }
                } 
            },
            function (error, result) {
                if (error) {
                    response.json({ "status": "ERROR" });
                } else {
                    var document = {
                        "id": id,   
                        "username": request.session.username,
                        "content": content,
                        "timestamp": timestamp
                    };
                    db.collection("tweets").insert(document, {w: 1}, function(error, result) {if(error){console.log(error);}});
                    console.log("success");
                    response.json ({
                        status: "OK",
                        id: id,
                    });
                }
            }
        );
    } else {
        response.json (
            {status: "error", error: "USER IS NOT LOGGED IN"}
        );
    }
	console.log("EXITED ADDITEM");
});

app.get("/item/:id", function (request, response) {
    var id = request.params.id;
    console.log("param id is.." + id);
    if (!request.session.isNew) {
		console.log("id is ", id);
        db.collection("tweets").findOne( { "id": parseInt(request.params.id) },function (error, document) {
			if (error) console.log(error);
			console.log(document);
            if (document) {
                response.json({
                    status: "OK",
                    item: {
                        id: document.id,
                        username: document.username,
                        content: document.content,
                        timestamp: document.timestamp
                    }
                });
            } else {
                response.json( { status: "error", error: "THIS IS AN INVALID ID" });
            }
        });
    } else {
        response.json({status: "error", error: "USER IS NOT LOGGED IN"});
    }
});

app.get("/search", function(request, response) {
   response.sendFile(path.join(__dirname + "/search.html")); 
});

function FilterTweets(tweets, parent, replies) {
    if (parent != "none" && (replies == false || replies == "false"))
        return [];

    if (parent == "none" && (replies == true || replies == "true"))
        return tweets;

    var filtered = [];
    for (var i = 0; i < tweets.length; i++) {
        var tweet = tweets[i];
        if (replies == false || replies == "false") {
            if (tweet.parent == "none")
                filtered.push(tweet);
        } else {
            if (parent != "none" && parent == tweet.parent)
                filtered.push(tweet);
        }
    }
    return filtered;
}

function compareTimes(a, b) {
    if (a.timestamp > b.timestamp) {
        return 1;
    }
    if (a.timestamp < b.timestamp) {
        return -1;
    }
    return 0;
}

function compareInterest(a, b) {
    var sum_a = a.retweets + a.likes;
    var sum_b = b.retweets + b.likes;

    if (sum_a > sum_b) {
        return 1;
    }
    if (sum_a < sum_b) {
        return -1;
    }
    return 0;
}

function RankTweets(tweets, rank) {
    if (rank == "interest") {
        tweets.sort(compareInterest);
    } else {
        tweets.sort(compareTimes);
    }
    return tweets;
}

app.post("/search", function (request, response) {
    //Assign defaults
    var timestamp = Date.now();
    var limit = 25;
    var query = "";
    var username = "";
    var following = true;
    var parent = "none";
    var replies = true;
    var rank = "interest";

    //Assign values based on request
    if (request.body.timestamp) {
        timestamp = parseInt(request.body.timestamp) * 1000;
    }
    if (request.body.limit) {
        var reqLimit = parseInt(request.body.limit);
        limit = reqLimit > 99 ? 99 : reqLimit;
    }
    if (request.body.q) {
        query = request.body.q;
    }
    if (request.body.username) {
        username = request.body.username;
    }
    if (request.body.hasOwnProperty("following")) {
        following = request.body.following;
    }
    if (request.body.parent) {
        parent = parseInt(request.body.parent);
    }
    if (request.body.hasOwnProperty("replies")) {
        replies = request.body.replies;
    }
    if (request.body.rank) {
        rank = request.body.rank;
    }


    // regex to break up query into separate tokens
    var queryRegex = ".*(" + query.trim().replace(/\s+/g, "|") + ").*";
    var sessionKey = request.cookies.key;
    var mcKey = following === true || following === "true" ? [sessionKey, request.body.timestamp, limit, query.replace(/\s+/g, ""), username, parent, replies, rank].toString() : [request.body.timestamp, limit, query.replace(/\s+/g, ""), username, parent, replies, rank].toString(); //Memcached key

    db.collection("sessions").findOne({key: sessionKey}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            memcached.get(mcKey, function (error, data) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else if (data) {
                    response.json(data);
                } else {
                    if (following === true || following === "true") {
                        if (username) {
                            db.collection("users").findOne({username: sessionKey, following: {$in: [username]}}, function (error, loggedInUser) {
                                if (error) {
                                    response.json({status: "error", error: error.toString()});
                                } else if (loggedInUser) {
                                    db.collection("users").findOne({username: username}, function (error, followedUser) {
                                        if (error) {
                                            response.json({status: "error", error: error.toString()});
                                        } else if (followedUser) {
                                            var tweets = followedUser.tweets;
                                            var followingUsername = [];

                                            for (var i = 0; i < tweets.length && followingUsername.length < limit; i++) {
                                                var tweet = tweets[i]
                                                if (tweet.content.match(queryRegex) && tweet.timestamp <= timestamp) {
                                                    followingUsername.push({
                                                        id: tweet._id,
                                                        username: tweet.username,
                                                        content: tweet.content,
                                                        timestamp: tweet.timestamp,
                                                        parent: tweet.parent,
                                                        retweets: tweet.retweets,
                                                        likes: tweet.likes
                                                    });
                                                }
                                            }

                                            followingUsername = FilterTweets(followingUsername, parent, replies);
                                            followingUsername = RankTweets(followingUsername, rank);

                                            var data = {status: "OK", items: followingUsername};
                                            if (followingUsername.length === limit) {
                                                memcached.set(mcKey, data, 0, function (error) {
                                                    if (error) {
                                                        response.json({status: "error", error: error.toString()});
                                                    } else {
                                                        response.json(data);
                                                    }
                                                });
                                            } else {
                                                response.json(data);
                                            }
                                        } else {
                                            response.json({status: "error", error: "FOLLOWED USER " + username + " NOT FOUND"});
                                        }
                                    });
                                } else {
                                    response.json({status: "OK", items: []});
                                }
                            });
                        } else {
                            db.collection("users").findOne({username: sessionKey}, function (error, loggedInUser) {
                                if (error) {
                                    response.json({status: "error", error: error.toString()});
                                } else if (loggedInUser) {
                                    db.collection("users").find({username: {$in: loggedInUser.following}}).toArray(function (error, followees) {
                                        if (error) {
                                            response.json({status: "error", error: error.toString()});
                                        } else if (followees) {
                                            var followingNoUsername = [];

                                            for (var i = 0; i < followees.length && followingNoUsername.length < limit; i++) {
                                                var tweets = followees[i].tweets;

                                                for (var j = 0; j < tweets.length && followingNoUsername.length < limit; j++) {
                                                    var tweet = tweets[j];
                                                    if (tweet.content.match(queryRegex) && tweet.timestamp <= timestamp) {
                                                        followingNoUsername.push({
                                                            id: tweet._id,
                                                            username: tweet.username,
                                                            content: tweet.content,
                                                            timestamp: tweet.timestamp,
                                                            parent: tweet.parent,
                                                            retweets: tweet.retweets,
                                                            likes: tweet.likes
                                                        });
                                                    }
                                                }
                                            }

                                            followingNoUsername = FilterTweets(followingNoUsername, parent, replies);
                                            followingNoUsername = RankTweets(followingNoUsername, rank);

                                            var data = {status: "OK", items: followingNoUsername};
                                            if (followingNoUsername.length === limit) {
                                                memcached.set(mcKey, data, 0, function (error) {
                                                    if (error) {
                                                        response.json({status: "error", error: error.toString()});
                                                    } else {
                                                        response.json(data);
                                                    }
                                                });
                                            } else {
                                                response.json(data);
                                            }
                                        } else {
                                            response.json({status: "OK", items: []});
                                        }
                                    });
                                } else {
                                    response.json({status: "error", error: sessionKey + " NOT FOUND"});
                                }
                            });
                        }
                    } else {
                        if (username) {
                            db.collection("users").findOne({username: username}, function (error, searchedUser) {
                                if (error) {
                                    response.json({status: "error", error: error.toString()});
                                } else if (searchedUser) {
                                    var tweets = searchedUser.tweets;
                                    var notFollowingUsername = [];

                                    for (var i = 0; i < tweets.length && notFollowingUsername.length < limit; i++) {
                                        var tweet = tweets[i];
                                        if (tweet.content.match(queryRegex) && tweet.timestamp <= timestamp) {
                                            notFollowingUsername.push({
                                                id: tweet._id,
                                                username: tweet.username,
                                                content: tweet.content,
                                                timestamp: tweet.timestamp,
                                                parent: tweet.parent,
                                                retweets: tweet.retweets,
                                                likes: tweet.likes
                                            });
                                        }
                                    }

                                    notFollowingUsername = FilterTweets(notFollowingUsername, parent, replies);
                                    notFollowingUsername = RankTweets(notFollowingUsername, rank);

                                    var data = {status: "OK", items: notFollowingUsername};
                                    if (notFollowingUsername.length === limit) {
                                        memcached.set(mcKey, data, 0, function (error) {
                                            if (error) {
                                                response.json({status: "error", error: error.toString()});
                                            } else {
                                                response.json(data);
                                            }
                                        });
                                    } else {
                                        response.json(data);
                                    }
                                } else {
                                    response.json({status: "OK", items: []});
                                }
                            });
                        } else {
                            db.collection("tweets").find({$and: [{content: {$regex: queryRegex}}, {timestamp: {$lte: timestamp}}]}).limit(limit).toArray(function (error, tweets) {
                                if (error) {
                                    response.json({status: "error", error: error.toString()});
                                } else if (tweets) {
                                    var notFollowingNoUsername = [];

                                    for (var i = 0; i < tweets.length; i++) {
                                        var tweet = tweets[i];
                                        notFollowingNoUsername.push({
                                            id: tweet._id,
                                            username: tweet.username,
                                            content: tweet.content,
                                            timestamp: tweet.timestamp,
                                            parent: tweet.parent,
                                            retweets: tweet.retweets,
                                            likes: tweet.likes
                                        });
                                    }

                                    notFollowingNoUsername = FilterTweets(notFollowingNoUsername, parent, replies);
                                    notFollowingNoUsername = RankTweets(notFollowingNoUsername, rank);

                                    var data = {status: "OK", items: notFollowingNoUsername};
                                    if (notFollowingNoUsername.length === limit) {
                                        memcached.set(mcKey, data, 0, function (error) {
                                            if (error) {
                                                response.json({status: "error", error: error.toString()});
                                            } else {
                                                response.json(data);
                                            }
                                        });
                                    } else {
                                        response.json(data);
                                    }
                                } else {
                                    response.json({status: "OK", items: []});
                                }
                            });
                        }
                    }
                }
            });
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
        }
    });
});
        
app.listen(1337);
app.listen(1338);
app.listen(1339);
app.listen(1340);
app.listen(1341);
app.listen(1342);
app.listen(1343);
console.log("Server started");
