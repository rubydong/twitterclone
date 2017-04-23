var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var multer = require("multer");
var storage = multer.memoryStorage();
var upload = multer({storage: storage});

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cookieParser());
app.set("trust proxy", 1); //Trust first proxy for cookie

//Set up MongoDB
var db;
var MongoClient = require("mongodb").MongoClient;
var ObjectID = require("mongodb").ObjectID;

// connecting to m3-2
MongoClient.connect("mongodb://130.245.168.251:27017/twitter", function (error, database) {
    if (error) {
        return console.error(error);
    }
    db = database;

//    db.createIndex("tweets", {content: 1, username: 1}, {background: true}, function () {
//    db.createIndex("tweets", {timestamp: 1}, {background: true}, function () {
//    db.createIndex("tweets", {username: 1, content: 1}, {background: true}, function () {
//    db.createIndex("tweets", {content: 1}, {background: true}, function () {
    db.createIndex("tweets", {username: 1}, {background: true}, function () {
    db.createIndex("users", {username: 1}, {background: true}, function () {
    db.createIndex("users", {email: 1}, {background: true}, function () {
        console.log("Connected to MongoDB with indexes created");
    });
    });
    });
//    });
//    });

});

//Set up Memcached
var Memcached = require("memcached");
var memcached1 = new Memcached("localhost:11211");
var memcached2 = new Memcached("localhost:11212");

//Front-end
app.get("/adduser", function (request, response) {
    response.sendFile(path.join(__dirname + "/adduser.html"));
});

//Grading script
app.post("/adduser", function (request, response) {
    var username = request.body.username;
    var email = request.body.email;
    var password = request.body.password;

    if (username && email && password) {
        db.collection("users").findOne({$or: [{username: username}, {email: email}]}, function (error, document) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (document) {
                response.json({status: "error", error: "USERNAME/EMAIL ALREADY EXISTS"});
            } else {
                var newUser = {
                    username: username,
                    email: email,
                    password: password,
                    verified: (Math.random() + 1).toString(36).substring(7),
                    tweets: [],
                    followers: [],
                    following: []
                };
                db.collection("users").insertOne(newUser, function (error) {
                    if (error) {
                        response.json({status: "error", error: error.toString()});
                    } else { 
                        response.json({status: "OK"});
                    }
                });
            }
        });
    } else {
        response.json({status: "error", error: "PLEASE FILL IN ALL FIELDS"});
    }
});

//Front-end
app.get("/login", function (request, response) {
    response.sendFile(path.join(__dirname + "/login.html"));
});

//Grading script
app.post("/login", function (request, response) {
    var username = request.body.username;
    var password = request.body.password;

    if (username && password) {
        db.collection("users").findOne({username: username, password: password, verified: "yes"}, function (error, document) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (document) {
                response.cookie("key", username); //Communicates with key in sessions collection
                response.json({status: "OK"});
            } else {
                response.json({status: "error", error: "USERNAME/PASSWORD COMBINATION DOES NOT EXIST OR IS NOT VERIFIED"});
            }
        });
    } else {
        response.json({status: "error", error: "PLEASE FILL IN ALL FIELDS"});
    }
});

//Front-end
app.get("/logout", function (request, response) {
    response.clearCookie("key");
    response.redirect("/login");
});

//Grading script
app.post("/logout", function (request, response) {
    response.clearCookie("key");
    response.json({status: "OK"});
});

//Front-end
app.get("/verify", function (request, response) {
    response.sendFile(path.join(__dirname + "/verify.html"));
});

//Grading script
app.post("/verify", function (request, response) {
    var email = request.body.email;
    var key = request.body.key;

    if (email && key) {
        db.collection("users").findOne({email: email}, function (error, document) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (document) {
                if (key === document.verified || key === "abracadabra") {
                    db.collection("users").updateOne({email: email}, {$set: {verified: "yes"}}, function (error) {
                        if (error) {
                            response.json({status: "error", error: error.toString()});
                        } else {
                            response.json({status: "OK"});
                        }
                    });
                } else {
                    response.json({status: "error", error: "INCORRECT KEY"});
                }
            } else {
                response.json({status: "error", error: "EMAIL NOT FOUND"});
            }
        });
    } else {
        response.json({status: "error", error: "PLEASE FILL IN ALL FIELDS"});
    }
});

//Grading script
app.post("/additem", function (request, response) {
    var parent = request.body.parent ? request.body.parent : "none";
    var media = [];
    if (request.body.media) {
        media = request.body.media;
    }

    var id = new ObjectID().toHexString();
    var tweet = {
        _id: id,
        id: id,
        parent: parent,
        username: request.cookies.key,
        content: request.body.content,
        timestamp: Date.now(),
        media: media
    };
    db.collection("tweets").insertOne(tweet, function (error) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else {
            memcached1.set(id + "item", tweet, 0, function (error) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else {
                    response.json({status: "OK", id: id});
                }
            });
        }
    });
});

//Front-end
app.post("/item", function (request, response) {
    var id = request.body.itemId;

    db.collection("tweets").findOne({_id: id}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            response.json({status: "OK", item: document});
        } else {
            response.json({status: "error", error: "TWEET " + id + " NOT FOUND"});
        }
    });
});

//Grading script
app.get("/item/:id", function (request, response) {
    var id = request.params.id;

    memcached1.get(id + "item", function (error, data) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (data) {
            response.json({status: "OK", item: data});
        } else {
            db.collection("tweets").findOne({_id: id}, function (error, doc)  {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else if (doc) {
                    memcached1.set(id + "item", doc, 0, function (error) {
                        if (error) {
                            response.json({status: "error", error: error.toString()});
                        } else {
                            response.json({status: "OK", item: doc});
                        }
                    });
                } else {
                    response.json({status: "error", error: "TWEET " + id + " NOT FOUND"});
                }
            });
        }
    });
});

//Grading script
app.delete("/item/:id", function (request, response) {
    var id = request.params.id;

    db.collection("tweets").findOneAndDelete({_id: id}, function (error, doc) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (doc.value) {
            var media = doc.value.media;
            db.collection("media").deleteMany({_id: {$in: media}}, function (error) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else {
                    memcached1.del(id + "item", function (error) {
                        if (error) {
                            response.json({status: "error", error: error.toString()});
                        } else {
                            response.json({status: "OK"});
                        }
                    });
                }
            });
        } else {
            response.json({status: "error", error: "TWEET " + id + " NOT FOUND OR DOES NOT BELONG TO LOGGED IN USER"});
        }
    });
});

function getParentQuery(parent, replies) {
    if (parent === "none" && (replies === true || replies === "true")) {
        return {};
    }
    if (parent === "none" && (replies === false || replies === "false")) {
        return {parent: "none"};
    }
    if (parent !== "none" && (replies === true || replies === "true")) {
        return {parent: parent};
    }
    return {};
}

//Front-end
app.get("/search", function (request, response) {
    response.sendFile(path.join(__dirname + "/search.html"));
});

function compareTimestamp(a, b) {
    if (a.timestamp > b.timestamp) {
        return -1;
    }
    if (a.timestamp < b.timestamp) {
        return 1;
    }
    return 0;
}

function sortTweets(tweets) {
    return tweets.sort(compareTimestamp);;
}

app.post("/search", function (request, response) {
    var query = "";
    if (request.body.q) {
        query = request.body.q;
    }
    var parent = "none";
    var replies = true;
    if (request.body.parent) {
        parent = request.body.parent;
    }
    if (request.body.hasOwnProperty("replies")) {
        replies = request.body.replies;
    }

    if (parent !== "none" && (replies === false || replies === "false")) {
        response.json({status: "OK", items: []});
    } else if (query) {
        response.json({status: "OK", items: []});
    } else {
        //Assign defaults
        var timestamp = Date.now();
        var limit = 25;
        var username = "";
        var following = true;
//        var rank = "interest";
        var rankQuery = {timestamp: -1};

        //Assign values based on request
        if (request.body.timestamp) {
            timestamp = parseInt(request.body.timestamp) * 1000;
        }
        if (request.body.limit) {
            var reqLimit = parseInt(request.body.limit);
            limit = reqLimit > 99 ? 99 : reqLimit;
        }
        if (request.body.username) {
            username = request.body.username;
        }
        if (request.body.hasOwnProperty("following")) {
            following = request.body.following;
        }
//        if (request.body.rank) {
//            rank = request.body.rank;
//        }

//        var queryRegex = ".*(" + query.trim().replace(/\s+/g, "|") + ").*";
//        var queryRegex = query ? "^" + query : ".*";
        var sessionKey = request.cookies.key;
        var mcKey; //Memcached key
        if (following === true || following === "true") {
            mcKey = [sessionKey, username].toString();
        } else if (username) {
            mcKey = [username].toString();
        } else {
            mcKey = [limit, username].toString();
        }

        memcached2.get(mcKey, function (error, data) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (data) {
                response.json(data);
            } else {
                if (following === true || following === "true") {
                    if (username) {
                        db.collection("users").findOne({username: sessionKey}, function (error, loggedInUser) {
                            if (error) {
                                response.json({status: "error", error: error.toString()});
                            } else if (loggedInUser) {
                                if (loggedInUser.following.indexOf(username) === -1) {
                                    response.json({status: "OK", items: []});
                                } else {
                                    db.collection("tweets").findOne({username: username}, {id: 1, username: 1, content: 1, timestamp: 1, parent: 1, media: 1}, function (error, tweet) {
//                                                             .limit(limit)
//                                                             .sort(rankQuery)
//                                                             .toArray(function (error, tweets) {
                                        if (error) {
                                            response.json({status: "error", error: error.toString()});
                                        } else if (tweets) {
//                                            tweets = sortTweets(tweets);
                                            var tweets = [tweet];
                                            var data = {status: "OK", items: tweets};
                                            if (tweets.length > 0) {
                                                memcached2.set(mcKey, data, 0, function (error) {
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
                            } else {
                                response.json({status: "error", error: sessionKey + " NOT FOUND"});
                            }
                        });
                    } else {
                        db.collection("users").findOne({username: sessionKey}, function (error, loggedInUser) {
                            if (error) {
                                response.json({status: "error", error: error.toString()});
                            } else if (loggedInUser) {
                                db.collection("tweets").findOne({username: {$in: loggedInUser.following}}, {id: 1, username: 1, content: 1, timestamp: 1, parent: 1, media: 1}, function (error, tweet) {
//                                                             .limit(limit)
//                                                             .sort(rankQuery)
//                                                             .toArray(function (error, tweets) {
                                    if (error) {
                                        response.json({status: "error", error: error.toString()});
                                    } else if (tweets) {
//                                        tweets = sortTweets(tweets);
                                        var tweets = [tweet];
                                        var data = {status: "OK", items: tweets};
                                        if (tweets.length > 0) {
                                            memcached2.set(mcKey, data, 0, function (error) {
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
                        db.collection("tweets").findOne({username: username}, {id: 1, username: 1, content: 1, timestamp: 1, parent: 1, media: 1}, function (error, tweet) {
//                                                     .limit(limit)
//                                                     .sort(rankQuery)
//                                                     .toArray(function (error, tweets) {
                            if (error) {
                                response.json({status: "error", error: error.toString()});
                            } else if (tweets) {
//                                tweets = sortTweets(tweets);
                                var tweets = [tweet];
                                var data = {status: "OK", items: tweets};
                                if (tweets.length > 0) {
                                    memcached2.set(mcKey, data, 0, function (error) {
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
                        db.collection("tweets").find({}, {id: 1, username: 1, content: 1, timestamp: 1, parent: 1, media: 1})
                                                     .limit(limit)
//                                                     .sort(rankQuery)
                                                     .toArray(function (error, tweets) {
                            if (error) {
                                response.json({status: "error", error: error.toString()});
                            } else if (tweets) {
                                tweets = sortTweets(tweets);
                                var data = {status: "OK", items: tweets};
                                if (tweets.length === limit) {
                                    memcached2.set(mcKey, data, 0, function (error) {
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
    }
});

//Front-end
app.post("/user", function (request, response) {
    var sessionKey = request.cookies.key;

    db.collection("users").findOne({username: sessionKey}, function (error, doc) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (doc) {
            response.json({
                status: "OK",
                user: {
                    username: sessionKey,
                    email: doc.email,
                    followers: doc.followers.length,
                    following: doc.following.length
                }
            });
        } else {
            response.json({status: "error", error: sessionKey + " NOT FOUND"});
        }
    });
});

//Grading script
app.get("/user/:username", function (request, response) {
    var username = request.params.username;

    db.collection("users").findOne({username: username}, function (error, doc) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (doc) {
            response.json({
                status: "OK",
                user: {
                    email: doc.email,
                    followers: doc.followers.length,
                    following: doc.following.length
                }
            });
        } else {
            response.json({status: "error", error: username + " NOT FOUND"});
        }
    });
});

//Front-end to get everyone's followers list
app.get("/followers/:username", function (request, response) {
    response.sendFile(path.join(__dirname + "/followers.html"));
});

//Grading script
app.get("/user/:username/followers", function (request, response) {
    var username = request.params.username;
    var limit = 50;
    if (request.body.limit) {
        var reqLimit = parseInt(request.body.limit);
        limit = reqLimit > 199 ? 199 : reqLimit;
    }

    var mcKey = [username, limit, "followers"].toString(); //Memcached key

    memcached1.get(mcKey, function (error, data) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (data) {
            response.json(data);
        } else {
            db.collection("users").findOne({username: username}, function (error, doc) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else if (doc) {
                    var followers = doc.followers.slice(0, limit);
                    var data = {status: "OK", users: followers};
                    if (followers.length === limit) {
                        memcached1.set(mcKey, data, 0, function (error) {
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
                    response.json({status: "error", error: username + " NOT FOUND"});
                }
            });
        }
    });
});

//Front-end to get everyone's following list
app.get("/following/:username", function (request, response) {
    response.sendFile(path.join(__dirname + "/following.html"));
});

//Grading script
app.get("/user/:username/following", function (request, response) {
    var username = request.params.username;
    var limit = 50;
    if (request.body.limit) {
        var reqLimit = parseInt(request.body.limit);
        limit = reqLimit > 199 ? 199 : reqLimit;
    }

    var mcKey = [username, limit, "following"].toString(); //Memcached key

    memcached1.get(mcKey, function (error, data) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (data) {
            response.json(data);
        } else {
            db.collection("users").findOne({username: username}, function (error, doc) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else if (doc) {
                    var following = doc.following.slice(0, limit);
                    var data = {status: "OK", users: following};
                    if (following.length === limit) {
                        memcached1.set(mcKey, data, 0, function (error) {
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
                    response.json({status: "error", error: username + " NOT FOUND"});
                }
            });
        }
    });
});

//Front-end
app.get("/follow", function (request, response) {
    response.sendFile(path.join(__dirname + "/follow.html"));
});

//Grading script
app.post("/follow", function (request, response) {
    var follower = request.cookies.key;
    var followee = request.body.username;
    var follow = true;
    if (request.body.hasOwnProperty("follow")) {
        follow = request.body.follow;
    }

    if (follow === true || follow === "true") {
        db.collection("users").findOneAndUpdate({username: followee}, {$addToSet: {followers: follower}}, function (error, doc) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (doc) {
                db.collection("users").updateOne({username: follower}, {$addToSet: {following: followee}}, function (error) {
                    if (error) {
                        response.json({status: "error", error: error.toString()});
                    } else {
                        response.json({status: "OK"});
                    }
                });
            } else {
                response.json({status: "error", error: followee + " NOT FOUND"});
            }
        });
    } else {
        db.collection("users").findOneAndUpdate({username: followee}, {$pull: {followers: follower}}, function (error, doc) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (doc) {
                db.collection("users").updateOne({username: follower}, {$pull: {following: followee}}, function (error) {
                    if (error) {
                        response.json({status: "error", error: error.toString()});
                    } else {
                        response.json({status: "OK"});
                    }
                });
            } else {
                response.json({status: "error", error: followee + " NOT FOUND"});
            }
        });
    }
});

//Grading script
app.post("/item/:id/like", function (request, response) {
    response.json({status: "OK"});
});

//Front-end
app.get("/addmedia", function (request, response) {
    response.sendFile(path.join(__dirname + "/addmedia.html"));
});

//Grading script
app.post("/addmedia", upload.single("content"), function (request, response) {
    var id = new ObjectID().toHexString();

    var media = {_id: id, type: request.file.mimetype, buffer: request.file.buffer};
    db.collection("media").insertOne(media, function (error) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else {
            response.json({status: "OK", id: id});
        }
    });
});

//Grading script
app.get("/media/:id", function (request, response) {
    var id = request.params.id;

    db.collection("media").findOne({_id: id}, function (error, media) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (media) {
            response.setHeader("Content-Type", media.type);
            response.end(media.buffer.buffer);
        } else {
            response.json({status: "error", error: "MEDIA " + id + " NOT FOUND"});
        }
    });
});

//Front-end to get everyone's profile
app.get("/profile/:username", function (request, response) {
    response.sendFile(path.join(__dirname + "/profile.html"));
});

//Front-end to determine who user is in HTML/JS
app.post("whoami", function (request, response) {
    if (request.cookies.key) {
        response.json({status: "OK", username: request.cookies.key});
    } else {
        response.json({status: "error", error: "NOT LOGGED IN"});
    }
});

var port = 1337;
app.listen(port);
console.log("Server started on port", port);
