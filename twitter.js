var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var nodeMailer = require("nodemailer");

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cookieParser());
app.set("trust proxy", 1); //Trust first proxy for cookie

//Set up MongoDB
var db;
var MongoClient = require("mongodb").MongoClient;
var ObjectID = require("mongodb").ObjectID;
MongoClient.connect("mongodb://localhost:27017/twitter", function (error, database) {
    if (error) {
        return console.error(error);
    }
    db = database;
    db.createIndex("users", {username: 1, email: 1, password: 1, verified: 1, following: 1}, {background: true}, function () {
        db.createIndex("users", {username: 1}, {background: true}, function () {
            db.createIndex("tweets", {_id: 1, username: 1, content: 1, timestamp: 1}, {background: true}, function () {
                db.createIndex("sessions", {key: 1}, {background: true}, function () {
                    console.log("Connected to MongoDB with indexes created");
                });
            });
        });
    });
});

//Set up Memcached
var Memcached = require("memcached");
var memcached = new Memcached("localhost:11211");

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
                db.collection("sessions").insertOne({key: username}, function (error) {
                    if (error) {
                        response.json({status: "error", error: error.toString()});
                    } else {
                        response.cookie("key", username); //Communicates with key in sessions collection
                        response.json({status: "OK"});
                    }
                });
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
    db.collection("sessions").remove({key: request.cookies.key});
    response.clearCookie("key");
    response.redirect("/login");
});

//Grading script
app.post("/logout", function (request, response) {
    db.collection("sessions").remove({key: request.cookies.key}, function (error) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else {
            response.clearCookie("key");
            response.json({status: "OK"});
        }
    });
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
        subject: 'Email confirmation for Twitter',
        text: '',
        html: 'Your key is ' + key
    };
    transporter.sendMail(mailOptions, function (error) {
        if (error) {
            return console.log('Bad email');
        }
        console.log('Message sent');
    });
}

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
    var content = request.body.content;
    var sessionKey = request.cookies.key;

    db.collection("sessions").findOne({key: sessionKey}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            var id = new ObjectID().toHexString();
            var tweet = {
                _id: id,
                username: sessionKey,
                content: content,
                timestamp: Date.now()
            };
            db.collection("users").updateOne({username: sessionKey}, {$push: {tweets: tweet}}, function (error) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else {
                    db.collection("tweets").insertOne(tweet, function (error) {
                        if (error) {
                            response.json({status: "error", error: error.toString()});
                        } else {
                            response.json({status: "OK", id: id});
                        }
                    });
                }
            });
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
        }
    });
});

//Front-end
app.post("/item", function (request, response) {
    var id = request.body.itemId;

    if (request.cookies.key) {
        db.collection("tweets").findOne({_id: id}, function (error, document) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (document) {
                var tweet = {
                    id: document._id,
                    username: document.username,
                    content: document.content,
                    timestamp: document.timestamp
                };
                response.json({status: "OK", item: tweet});
            } else {
                response.json({status: "error", error: "TWEET " + id + " NOT FOUND"});
            }
        });
    } else {
        response.json({status: "error", error: "NOT LOGGED IN"});
    }
});

//Grading script
app.get("/item/:id", function (request, response) {
    var id = request.params.id;

    db.collection("sessions").findOne({key: request.cookies.key}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            memcached.get(id, function (error, data) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else if (data) {
                    response.json(data);
                } else {
                    db.collection("tweets").findOne({_id: id}, function (error, doc) {
                        if (error) {
                            response.json({status: "error", error: error.toString()});
                        } else if (doc) {
                            var tweet = {
                                id: doc._id,
                                username: doc.username,
                                content: doc.content,
                                timestamp: doc.timestamp
                            };
                            var data = {status: "OK", item: tweet};
                            memcached.set(id, data, 0, function (error) {
                                if (error) {
                                    response.json({status: "error", error: error.toString()});
                                } else {
                                    response.json(data);
                                }
                            });
                        } else {
                            response.json({status: "error", error: "TWEET " + id + " NOT FOUND"});
                        }
                    });
                }
            });
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
        }
    });
});

//Grading script
app.delete("/item/:id", function (request, response) {
    var id = request.params.id;
    var sessionKey = request.cookies.key;

    db.collection("sessions").findOne({key: sessionKey}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            db.collection("users").updateOne({username: sessionKey}, {$pull: {tweets: {_id: id}}}, function (error) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else {
                    db.collection("tweets").remove({_id: id, username: sessionKey}, function (error, result) {
                        if (error) {
                            response.json({status: "error", error: error.toString()});
                        } else if (result.result.n === 1) {
                            memcached.del(id, function (error) {
                                if (error) {
                                    response.json({status: "error", error: error.toString()});
                                } else {
                                    response.json({status: "OK"});
                                }
                            });
                        } else {
                            response.json({status: "error", error: "TWEET " + id + " NOT FOUND OR DOES NOT BELONG TO LOGGED IN USER"});
                        }
                    });
                }
            });
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
        }
    });
});

//Front-end
app.get("/search", function (request, response) {
    response.sendFile(path.join(__dirname + "/search.html"));
});

//Grading script
app.post("/search", function (request, response) {
    //Assign defaults
    var timestamp = Date.now();
    var limit = 25;
    var query = "";
    var username = "";
    var following = true;

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

    var queryRegex = ".*(" + query.trim().replace(/\s+/g, "|") + ").*";
    var sessionKey = request.cookies.key;
    var mcKey = following === true || following === "true" ? [sessionKey, request.body.timestamp, limit, query.replace(/\s+/g, ""), username].toString() : [request.body.timestamp, limit, query.replace(/\s+/g, ""), username].toString(); //Memcached key

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
                                                        timestamp: tweet.timestamp
                                                    });
                                                }
                                            }
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
                                                            timestamp: tweet.timestamp
                                                        });
                                                    }
                                                }
                                            }
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
                                                timestamp: tweet.timestamp
                                            });
                                        }
                                    }
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
                                            timestamp: tweet.timestamp
                                        });
                                    }
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

//Front-end
app.post("/user", function (request, response) {
    var sessionKey = request.cookies.key;

    db.collection("sessions").findOne({key: sessionKey}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
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
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
        }
    });
});

//Grading script
app.get("/user/:username", function (request, response) {
    var username = request.params.username;

    db.collection("sessions").findOne({key: request.cookies.key}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
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
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
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

    db.collection("sessions").findOne({key: request.cookies.key}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            memcached.get(mcKey, function (error, data) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else if (data) {
                    response.json(data);
                } else {
                    db.collection("users").findOne({username: username}, function (error, doc) {
                        if (error) {
                            response.json({status: "error", error: error.toString()});
                        } else if (doc) {
                            var followers = doc.followers;
                            var followersToSend = [];

                            for (var i = 0; i < followers.length && followersToSend.length < limit; i++) {
                                followersToSend.push(followers[i]);
                            }
                            var data = {status: "OK", users: followersToSend};
                            if (followersToSend.length === limit) {
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
                            response.json({status: "error", error: username + " NOT FOUND"});
                        }
                    });
                }
            });
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
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

    db.collection("sessions").findOne({key: request.cookies.key}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            memcached.get(mcKey, function (error, data) {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else if (data) {
                    response.json(data);
                } else {
                    db.collection("users").findOne({username: username}, function (error, doc) {
                        if (error) {
                            response.json({status: "error", error: error.toString()});
                        } else if (doc) {
                            var following = doc.following;
                            var followingToSend = [];

                            for (var i = 0; i < following.length && followingToSend.length < limit; i++) {
                                followingToSend.push(following[i]);
                            }
                            var data = {status: "OK", users: followingToSend};
                            if (followingToSend.length === limit) {
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
                            response.json({status: "error", error: username + " NOT FOUND"});
                        }
                    });
                }
            });
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
        }
    });
});

//Front-end
app.get("/follow", function (request, response) {
    response.sendFile(path.join(__dirname + "/follow.html"));
});

//Grading script
app.post("/follow", function (request, response) {
    var followee = request.body.username;
    var follow = true;
    if (request.body.hasOwnProperty("follow")) {
        follow = request.body.follow;
    }
    var follower = request.cookies.key;

    db.collection("sessions").findOne({key: follower}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            if (follow === true || follow === "true") {
                db.collection("users").findOne({username: followee}, function (error, doc) {
                    if (error) {
                        response.json({status: "error", error: error.toString()});
                    } else if (doc) {
                        db.collection("users").updateOne({username: followee}, {$addToSet: {followers: follower}}, function (error) {
                            if (error) {
                                response.json({status: "error", error: error.toString()});
                            } else {
                                db.collection("users").updateOne({username: follower}, {$addToSet: {following: followee}}, function (error) {
                                    if (error) {
                                        response.json({status: "error", error: error.toString()});
                                    } else {
                                        response.json({status: "OK"});
                                    }
                                });
                            }
                        });
                    } else {
                        response.json({status: "error", error: followee + " NOT FOUND"});
                    }
                });
            } else {
                db.collection("users").findOne({username: followee}, function (error, doc) {
                    if (error) {
                        response.json({status: "error", error: error.toString()});
                    } else if (doc) {
                        db.collection("users").updateOne({username: followee}, {$pull: {followers: follower}}, function (error) {
                            if (error) {
                                response.json({status: "error", error: error.toString()});
                            } else {
                                db.collection("users").updateOne({username: follower}, {$pull: {following: followee}}, function (error) {
                                    if (error) {
                                        response.json({status: "error", error: error.toString()});
                                    } else {
                                        response.json({status: "OK"});
                                    }
                                });
                            }
                        });
                    } else {
                        response.json({status: "error", error: followee + " NOT FOUND"});
                    }
                });
            }
        } else {
            response.json({status: "error", error: "NOT LOGGED IN"});
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
