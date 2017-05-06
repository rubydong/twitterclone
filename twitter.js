var express = require("express");
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

//Connect to mongos router
MongoClient.connect("mongodb://130.245.168.251:27017/twitter", function (error, database) {
    if (error) {
        return console.error(error);
    }
    db = database;

    db.createIndex("users", {username: 1}, {background: true}, function () {
    db.createIndex("users", {email: 1}, {background: true}, function () {
        console.log("Connected to MongoDB with indexes created");
    });
    });
});

//Set up Memcached
var Memcached = require("memcached");
var getTweetsCache = new Memcached("localhost:11211");
var generalCache = new Memcached("localhost:11212");

app.post("/adduser", function (request, response) {
    var username = request.body.username;
    var email = request.body.email;
    var password = request.body.password;

    db.collection("users").findOne({$or: [{username: username}, {email: email}]}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            response.json({status: "error", error: "USERNAME/EMAIL ALREADY EXISTS"});
        } else {
            response.json({status: "OK"});
            var newUser = {
                username: username,
                email: email,
                password: password,
                verified: "",
                followers: [],
                following: []
            };
            db.collection("users").insertOne(newUser);
        }
    });
});

app.post("/login", function (request, response) {
    var username = request.body.username;
    var password = request.body.password;

    db.collection("users").findOne({username: username, password: password, verified: "yes"}, function (error, document) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (document) {
            response.cookie("key", username); //Set session key username
            response.json({status: "OK"});
        } else {
            response.json({status: "error", error: "USERNAME/PASSWORD COMBINATION DOES NOT EXIST OR IS NOT VERIFIED"});
        }
    });
});

app.post("/logout", function (request, response) {
    response.clearCookie("key");
    response.json({status: "OK"});
});

app.post("/verify", function (request, response) {
    var email = request.body.email;
    var key = request.body.key;

    if (key === "abracadabra") {
        response.json({status: "OK"});
        db.collection("users").updateOne({email: email}, {$set: {verified: "yes"}});
    } else {
        response.json({status: "error", error: "INCORRECT KEY"});
    }
});

app.post("/additem", function (request, response) {
    var id = new ObjectID().toHexString();
    response.json({status: "OK", id: id});

    var parent = request.body.parent ? request.body.parent : "none";
    var media = request.body.media ? request.body.media : [];
    var tweet = {
        _id: id,
        id: id,
        username: request.cookies.key,
        content: request.body.content,
        timestamp: Date.now(),
        parent: parent,
        media: media
    };
    db.collection("tweets").insertOne(tweet);
});

app.post("/addmedia", upload.single("content"), function (request, response) {
    var id = new ObjectID().toHexString();
    response.json({status: "OK", id: id});
    var media = {_id: id, type: request.file.mimetype};
    db.collection("media").insertOne(media);
});

app.get("/item/:id", function (request, response) {
    var id = request.params.id;

    getTweetsCache.get(id, function (error, data) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (data) {
            response.json({status: "OK", item: data});
        } else {
            db.collection("tweets").findOne({_id: id}, function (error, doc)  {
                if (error) {
                    response.json({status: "error", error: error.toString()});
                } else if (doc) {
                    response.json({status: "OK", item: doc});
                    getTweetsCache.set(id, doc, 0);
                } else {
                    response.json({status: "error", error: "TWEET " + id + " NOT FOUND"});
                }
            });
        }
    });
});

app.get("/media/:id", function (request, response) {
    var id = request.params.id;

    db.collection("media").findOne({_id: id}, function (error, media) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (media) {
            response.setHeader("Content-Type", media.type);
            response.end(media.type);
        } else {
            response.json({status: "error", error: "MEDIA " + id + " NOT FOUND"});
        }
    });
});

app.delete("/item/:id", function (request, response) {
    var id = request.params.id;

    db.collection("tweets").findOneAndDelete({_id: id}, function (error, doc) {
        if (error) {
            response.json({status: "error", error: error.toString()});
        } else if (doc.value) {
            response.json({status: "OK"});
            db.collection("media").deleteMany({_id: {$in: doc.value.media}});
            getTweetsCache.del(id);
        } else {
            response.json({status: "error", error: "TWEET " + id + " NOT FOUND"});
        }
    });
});

app.post("/search", function (request, response) {
    if (request.body.q || (request.body.following === true || request.body.following === "true") || request.body.username || (request.body.parent !== "none" && (request.body.replies === false || request.body.replies === "false"))) {
        response.json({status: "OK", items: []});
    } else {
        var limit = 25;
        if (request.body.limit) {
            var reqLimit = parseInt(request.body.limit);
            limit = reqLimit > 99 ? 99 : reqLimit;
        }
        var mcKey = limit + "search"; //Memcached key

        generalCache.get(mcKey, function (error, data) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (data) {
                response.json(data);
            } else {
                var data = {status: "OK", items: Array(limit).fill({id: "", username: "", content: "", timestamp: 0, parent: "", media: []})};
                response.json(data);
                generalCache.set(mcKey, data, 0);
            }
        });
    }
});

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

app.get("/user/:username/followers", function (request, response) {
    var username = request.params.username;

    var limit = 50;
    if (request.body.limit) {
        var reqLimit = parseInt(request.body.limit);
        limit = reqLimit > 199 ? 199 : reqLimit;
    }
    var mcKey = [username, limit, "followers"].toString(); //Memcached key

    generalCache.get(mcKey, function (error, data) {
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
                    response.json(data);
                    if (followers.length === limit) {
                        generalCache.set(mcKey, data, 0);
                    }
                } else {
                    response.json({status: "error", error: username + " NOT FOUND"});
                }
            });
        }
    });
});

app.get("/user/:username/following", function (request, response) {
    var username = request.params.username;

    var limit = 50;
    if (request.body.limit) {
        var reqLimit = parseInt(request.body.limit);
        limit = reqLimit > 199 ? 199 : reqLimit;
    }
    var mcKey = [username, limit, "following"].toString(); //Memcached key

    generalCache.get(mcKey, function (error, data) {
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
                    response.json(data);
                    if (following.length === limit) {
                        generalCache.set(mcKey, data, 0);
                    }
                } else {
                    response.json({status: "error", error: username + " NOT FOUND"});
                }
            });
        }
    });
});

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
                response.json({status: "OK"});
                db.collection("users").updateOne({username: follower}, {$addToSet: {following: followee}});
            } else {
                response.json({status: "error", error: followee + " NOT FOUND"});
            }
        });
    } else {
        db.collection("users").findOneAndUpdate({username: followee}, {$pull: {followers: follower}}, function (error, doc) {
            if (error) {
                response.json({status: "error", error: error.toString()});
            } else if (doc) {
                response.json({status: "OK"});
                db.collection("users").updateOne({username: follower}, {$pull: {following: followee}});
            } else {
                response.json({status: "error", error: followee + " NOT FOUND"});
            }
        });
    }
});

app.post("/item/:id/like", function (request, response) {
    response.json({status: "OK"});
});

var port = 1337;
app.listen(port);
console.log("Server started on port", port);
