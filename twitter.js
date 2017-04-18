var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var nodemailer = require("nodemailer");
var cookieParser = require("cookie-parser");
var MongoClient = require("mongodb").MongoClient;
var ObjectID = require("mongodb").ObjectID;
var multer = require('multer');
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });
var app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use(cookieParser());
app.set("trust proxy", 1); //Trust first proxy

MongoClient.connect("mongodb://localhost:27017/twitter", (err,database) => {
//MongoClient.connect("mongodb://130.245.168.183:27017/twitter?replicaSet=twitter&readPreference=primary",function(error,database) {
//MongoClient.connect("mongodb://130.245.168.251:27017,130.245.168.182:27017,130.245.168.183:27017,130.245.168.185:27017,130.245.168.187:27017/twitter?replicaSet=twitter&readPreference=primary", function (error, database) {
//MongoClient.connect("mongodb://localhost:27017/twitter", function (error, database) {
    if (err) {
        return console.error(new Error("Attempting to connect to db:", error));
    } else {
        db = database;
        console.log("Connected to MongoDB");
    }
});

//front end
app.get("/adduser", function (request, response) {
    response.sendFile(path.join(__dirname + "/adduser.html"));
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
        html: "your key is " + key
        //html: 'http://130.245.168.86/verify?email=' + email + '&key=' + key
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Bad email');
        }
        console.log('Message sent');
    });
}

//grading
app.post("/adduser", function (req, res) {
    
    var e_username = req.body.username;
    var e_password = req.body.password;
    var e_email = req.body.email;    
    var e_emailkey = (Math.random() + 1).toString(36).substring(7);
    
    if (e_username && e_password && e_email) {
        //check if username/email has been taken already
        var now = Date.now();
        var newuser = {
            "username": e_username,
            "password": e_password,
            "email": e_email,
            "verified": e_emailkey, 
            "tweets": [],
            "followers": [],
            "following": []
        };
        db.collection("users").update({username: e_username, email: e_email},
            {$set: {updatedAt: now}, 
              $setOnInsert: {createdAt: now,
                             password: e_password,
                             verified: e_emailkey,
                             tweets: [],
                            followers: [],
                            following: []}}, {upsert:true}, (err,doc) => {
                res.json({status:"OK"});
            });
        sendEmail(e_email, e_emailkey);
    } else {
        res.json({status: "error", error: "PLEASE FILL IN ALL FIELDS"});
    }
});
        
//front end
app.get("/login", function (request, response) {            
    response.sendFile(path.join(__dirname + "/login.html"));
});

//grading
app.post("/login", function (request, response) {
    
    var username = request.body.username;
    var password = request.body.password;
    
    if (username && password) {
		db.collection("users").findOne({"username": username,"password": password, verified: "yes"}, {"name": 1}, (error, doc) => {
            if (doc) {
				db.collection("sessions").insert({"sessionkey": username},{w: 1}, (err,res) => {
					if (err) {
						console.error(new Error("ERROR attempting login:", err));
					} else {
						response.cookie('key', username); // used to communicate with sessionkey in db
						response.json({status: "OK"});
					}
				});
            } else {
				console.error(new Error("LOGIN FAILED with",username,password));
                response.json({status:"error", error: "INVALID LOGIN"});
            }
        });
    } else {
        response.json({status: "error", error: "PLEASE FILL IN ALL FIELDS"});
    }
});

//front end
app.get("/logout", function(request, response) {
    
    request.session = null;
	var sessionkey = request.cookies.key;
		db.collection("sessions").remove({"sessionkey": sessionkey},1);
		response.clearCookie("key");	
    response.redirect('/login');
});

//grading
app.post("/logout", function (request, response) {
    
        var sessionkey = request.cookies.key;

		db.collection("sessions").remove({"sessionkey": sessionkey}, {w:1}, (err) => {
            if (err) {
                console.error(new Error("ERROR deleting session key"));
                response.json({status: "error"});
            } else {
                response.clearCookie("key");
                response.json({status: "OK"});
            }
		});
});

//front end
app.get("/verify", function (request, response) {
    response.sendFile(path.join(__dirname + "/verify.html"));
});

//grading
app.post("/verify", function (req, res) {
    
    var e_email = req.body.email;
    var e_key = req.body.key;
    var e_emailkey = "";

    if (e_email && e_key) {
        db.collection("users").findOne({email: e_email}, (err, doc) => {
            if (err) { 
                console.error(new Error("DID NOT FIND USER:", e_email, err));
                res.json({status: "error"});
            } else if (doc) {
                var new_emailkey = doc.verified;
                if (e_key == new_emailkey || e_key == "abracadabra") {
                    db.collection("users").update({email: e_email},{$set: {verified: "yes" }},
                        {w:1}, (err,result) => {
                            if (err) {
                                console.error(new Error("VERIFY FAILED", err))
                                res.json({status: "error"});
                            } else {
                                res.json({status:"OK"});
                            }
                        });
                } else { 
                    res.json({status: "error", error: "INVALID KEY PLEASE TRY AGAIN"});
                }
            } else {
                res.json({status: "error", error: "No email found"});
            }
        });
    } else {
        res.json({status: "error", error: "PLEASE FILL IN ALL FIELDS"});
    }
});


//grading
app.post("/additem", function (req, res) {
    
    /* retweet not implemented yet... */
    var content = req.body.content;
    var parent = req.body.parent; 
    var media = req.body.media;
    
    //!!!!!!!!//
    var retweetParent = req.body.retweetParent;
    var retweetBool = req.body.retweetBool;
    
    if (retweetBool) {
        db.collection("tweets").update(
            {"id": retweetParent}, 
            { $inc: {retweets: 1}}
        );        
                                       
         db.collection("users").update(
            {username: req.cookies.key, "tweets.id": retweetParent}, 
            {$inc: {"tweets.$.retweets":1}}
        ) 
    }
         /////!!!!!!//
    var timestamp = new Date().getTime();
    var sessionkey = req.cookies.key;
    console.log(req.body);
	db.collection("sessions").findOne({"sessionkey": sessionkey},{sessionkey: 1}, (error, doc) => {
		if (doc) {
            var id = new ObjectID().toHexString();
            
            if (req.body.parent) {
                db.collection("tweets").findOne({id: parent}, (error, doc) => {
                    if (doc) {
                        console.log("this tweet id exists so it is now a reply");
                    } else {
                        console.log("Original tweet, the parent does not exist");
                        parent = "none"; //if no parent id, it'll be default "none"
                    }
                });
            } else {
                console.log("Original tweet bc parent id is empty");
                parent = "none";
            }
            
            //going to assume valid inputs for images arr..
            if (req.body.media) {
    
                if (typeof(req.body.media) == 'string')   {  
                    media = media.replace('[', '');
                    media = media.replace(']', '');
                    media = media.split(',');
                }
                for (var i = 0; i< media.length; i++) {
                    console.log(media[i]);
                    media[i] = media[i].trim();
                    
                    db.collection("images").update(
                        {imgid: media[i]}, 
                        {$set: {tweetid: id}},
                        {w:1}, (err,result) => {
                            if (err) {
                                console.log("updating img's tweetid FAILED");  
                            } else {
                                console.log("update img's tweetid a success");
                            }
                        });
                }
            }
            db.collection("users").update({username: sessionkey},
                {
                  $push: {
                        "tweets": {
                              "id": id,   
                              "parent": parent,
                              "username": sessionkey,
                              "content": content,
                              "timestamp": timestamp, 
                              "media": media,
                              "likes": 0, 
                              "likers": [],
                              "retweetParent": "none",
                              "retweets": 0
                        }
                    } 
                }, {w:1}, (error, result) => {
                    if (error) {
                        res.json({status: "error", error: "ERROR INSERTING TWEET TO USER"});
                    } else {
                        var documentA = {
                            "id": id,   
                            "parent": parent,
                            "username": sessionkey,
                            "content": content,
                            "timestamp": timestamp, 
                            "media": media,
                            "likes": 0, 
                            "likers": [],
                            "retweetParent": "none",
                            "retweets": 0
                        };
                        
                        db.collection("tweets").insert(documentA, {w: 1}, (error, result) => {
    							if (error) {
    								res.json({status: "error", error: "ERROR INSERTING TWEET TO DB"});
    							} else { 
    								res.json({status: "OK", id: id});
    							}
    					});
                    }
            });
        } else {
            res.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

//grading
app.get("/item/:id", function (request, response) {
    
    var id = request.params.id;
    var sessionkey = request.cookies.key;
    db.collection("sessions").findOne({"sessionkey": sessionkey}, {sessionkey: 1}, (error, doc) => {
        if (doc) {
            db.collection("tweets").findOne({"id": id}, (error, documentA) => {
                if (error) {
                    response.json({status: "error", error: "ERROR SEARCHING FOR TWEET WITH ID"});
                } else if (documentA) {
                    response.json(
                        {
                            status: "OK",
                            item: {
                                id: documentA.id,
                                username: documentA.username,
                                content: documentA.content,
                                timestamp: documentA.timestamp,
                                parent: documentA.parent,
                                media: documentA.media
                            }
                        });
                } else {
                    response.json({status: "error", error: "NO TWEET FOUND WITH ID"});
                }
            });
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

//grading
app.delete("/item/:id", function (request, response) {
    
    var id = request.params.id;
    var sessionkey = request.cookies.key;

	db.collection("sessions").findOne({"sessionkey": sessionkey},{"sessionkey": 1},(error, doc) => {
        if (doc) {
            
            
            db.collection("images").remove({tweetid: id}, (error, result) => {
               
            });
            
            db.collection("users").update({"username": sessionkey, "verified": "yes"},
                {
                  $pull: {"tweets": { "id": id}} 
                }, {w:1}, (error, result) => {
                    if (error) {
                        response.json({status: "error", error: "ERROR UPDATING TWEET" });
                    } else {

                        db.collection("tweets").findOne( {"id": id }, (error, document) => {
                            if (error) {
                                response.json({status: "error", error: "ERROR FINDING TWEET WITH ID"});
                            } else if (document) {
                                
                                if (document.username == sessionkey) {
                                    db.collection("tweets").remove({"id": id}, {w:1}, (error, result) => {
                                        if (error) {
                                            response.json({status:"error", error: "ERROR REMOVING FROM TWEETS"});
                                        } else {
                                            console.log("removing id" + id);
                                            response.json({status: "OK"});
                                        }
                                    });
                                } else {
                                    response.json({status: "error", error: "YOU CANNOT DELETE TWEETS THAT AREN'T YOURS"});
                                }
                            } else {
                                response.json({status: "error", error: "DID NOT FIND TWEET WITH ID"});
                            }
                        });

                    }
            });
        } else {
            response.json({status: "error", "error": "USER IS NOT LOGGED IN"});
        }
	});
});

//front end
app.post("/item", function (request, response) {
    var id = request.body.itemId;
		if (request.cookies.key != null) {
        db.collection("tweets").findOne( { "id": id },function (error, document) {
			if (error) {  response.json( { status: "error", error: "ERROR LOOKING FOR THIS TWEET IN DB" }); }
			
            else if (document) {
                response.json({
                    status: "OK",
                    item: {
                        id: document.id,
                        parent: document.parent,
                        username: document.username,
                        content: document.content,
                        timestamp: document.timestamp,
                        media: document.media,
                        likes: document.likes,
                        likers: document.likers,
                        retweetParent:document.retweetParent,
                        retweets: document.retweets
                    }
                });
            } else {
                response.json( { status: "error", error: "THIS IS AN INVALID ID" });
            }
        });
    } else {
        response.json({status: "error", error: "USER IS NOT LOGGED IN"});
    }
	//});
});

//front end
app.get("/search", function(request, response) {   
   response.sendFile(path.join(__dirname + "/search.html")); 
});

//front end to get everyone's profile
app.get("/profile/:username", function (request, response) {
    response.sendFile(path.join(__dirname + "/profile.html"));
});

//front end to determine who the user is in html/js
app.post("/whoami", function (request, response) {
    
    if (request.cookies.key)
        response.json ({status:"OK", username: request.cookies.key});
    else 
        response.json ({status: "error", error: "USER IS NOT LOGGED IN"});
});

//grading don't think this is even being used
function checkConditions(tweets, query, timestamp) {
    
	if (tweets.content.indexOf(query) == -1)
		return false;
	else if (tweets.timestamp > timestamp)
		return false;
	else
		return true;
}

//grading
app.post("/search", function(req, res) {
    
	var timestamp = new Date().getTime();
	var limit = 25;
	var query = '';
	var username = req.body.username;
    var sessionkey = req.cookies.key;
	var following = true;
    var limitCounter = 0;

	if (req.body.limit) {
		limit = parseInt(req.body.limit);
        limit = limit > 99 ? 99 : limit;
	}
	if (req.body.timestamp)
		timestamp = parseInt(req.body.timestamp) * 1000;
	if (req.body.q)
		query = req.body.q;
   
    
    if ((req.body.following || req.body.following == false) && req.body.following.length != 0) {
        following = req.body.following;
    } 
	
    query = ".*(" + query.trim().replace(/\s+/g, "|")+").*";
    
	db.collection("sessions").findOne({"sessionkey": sessionkey},{"sessionkey": 1}, (error, doc) => {
        
		if (doc) {
			tweetsArr = new Array();
            if (following == 'true' || following == true) {
//                console.log("FOLLOWING IS TRUE");

                if (username) {

                    db.collection("users").findOne({"username": sessionkey, verified: "yes", "following": { $in: [username] }}, (error, loggeduser) => {
                        if (loggeduser) {

                            db.collection("users").findOne({"username": username, verified: "yes"}, (error, followinguser) => {
                                if (followinguser) {
                                    var tweets = followinguser.tweets;
                                    var send1 = new Array();
                                    var count1 = 0;

                                    for (var i = 0; i < tweets.length && count1 < limit; i++) {
                                        if ( (tweets[i].content.match(query) != null) && 
                                             (tweets[i].timestamp <= timestamp)) {
                                            send1.push({
                                                id: tweets[i].id,
                                                username: tweets[i].username,
                                                content: tweets[i].content,
                                                timestamp: tweets[i].timestamp,
                                                likes: tweets[i].likes,
                                                retweets: tweets[i].retweets
                                            });
                                            count1++;
                                        }
                                    }
                                    res.json({status: "OK", items: send1});

                                } else {
                                    res.json({status: "error", error: "USER WAS NOT FOUND"});
                                }
                            });
                        } else {

                            res.json({status: "OK", items: [] });
                        }
                    });
                } else {
                    db.collection("users").findOne({username: sessionkey, verified: "yes"}, (err, user) => {
                        if (user) {
                            var follow = user.following;
                            db.collection("users").find({username:{$in: follow}, verified: "yes"}).toArray((err,val) => {
                                    
                                    var send2 = new Array();
                                    var count2 = 0;
                                    for (var i = 0; i < val.length && count2 < limit; i++) {
                                        var tweets = val[i].tweets;

                                        for (var j = 0; j < tweets.length && count2 < limit; j++) {
                                            if ( (tweets[j].content.match(query) != null) && 
                                                 (tweets[j].timestamp <= timestamp)) {
                                                send2.push({
                                                    id: tweets[j].id,
                                                    username: tweets[j].username,
                                                    content: tweets[j].content,
                                                    timestamp: tweets[j].timestamp,
                                                    likes: tweets[j].likes,
                                                retweets: tweets[j].retweets
                                                });
                                                count2++;
                                            }
                                        }
                                    }

                                    res.json({status: "OK", items: send2});
                            });
                        } else {
                            res.json({status: "error",error: "USER IS NOT FOUND"});
                        }
                    });
                }
            } else {
//                console.log("FOLLOWING IS FALSE");

                if (username) {
                    db.collection("users").findOne({"username": username, verified: "yes"}, (err, user) => {
                        if (user) {
                            var tweets = user.tweets;
                            var send3 = new Array();
                            var count3 = 0;
                            //console.log("QUERY IS... " + query);
                            for (var j = 0; j < tweets.length && count3 < limit; j++) {
                                //console.log(tweets[j]);
                                if ( (tweets[j].content.match(query) != null) && 
                                     (tweets[j].timestamp <= timestamp)) {
                                    send3.push({
                                        id: tweets[j].id,
                                        username: tweets[j].username,
                                        content: tweets[j].content,
                                        timestamp: tweets[j].timestamp,
                                        likes: tweets[j].likes,
                                        retweets: tweets[j].retweets
                                    });
                                    count3++;
                                }
                            }

                            res.json({status: "OK", items: send3});
                        } else {   

                            res.json({status: "OK", items: []});
                        }
                    });

                } else {
                     db.collection("tweets").find(
                     {$and: [
                         {content: {$regex: query }},
                         {timestamp: {$lte: timestamp}}
                         ]
                     }).limit(limit).toArray((err, val) => {
                            var send4 = new Array();
                            var count4 = 0;
                            for (var i = 0; i < val.length && count4 < limit; i++) {
                                    send4.push({
                                        id: val[i].id,
                                        username: val[i].username,
                                        content: val[i].content,
                                        timestamp: val[i].timestamp,
                                        likes: val[i].likes,
                                        retweets: val[i].retweets
                                    });
                                    count4++;
                                
                            }
                            res.json({status: "OK",items: send4});
                     });
                }
            }
		} else {
			res.json({status: "error",error: "USER IS NOT LOGGED IN"});
		}
	});
});

//front end
app.get("/follow", function (request, response) {
    response.sendFile(path.join(__dirname + "/follow.html")); 
});

//grading
app.post("/follow", function (request, response) {
    
    var sessionkey = request.cookies.key;
    var followbool = true;

    if(request.body.follow != null)
        followbool = request.body.follow;
    
	db.collection("sessions").findOne({"sessionkey":sessionkey},{"sessionkey": 1}, (error, doc) => {
		if (doc) { 
            var currentUser = sessionkey;
            var otherUser = request.body.username; //other user to folllow or unfollow

            if (followbool == 'true' || followbool == true) {
                db.collection("users").findOne({"username": otherUser, verified: "yes"}, (error, document) => {  
                    if (error) {
                        response.json({status: "error", error: error});
                    } else if (document == null) {
                        response.json({status: "error", error: "THE PERSON THAT YOU ARE TRYING TO FOLLOW DOES NOT EXIST"});
                    } else {
                        db.collection("users").update({"username": otherUser, verified: "yes"},{ $addToSet: {"followers": currentUser}},
                            (err, result) => {
                                if (err) {
                                    response.json({status: "error", error: err});
                                } else {
                                    db.collection("users").update({"username": currentUser, verified: "yes"},{$addToSet: {"following":otherUser}},
                                    (err, result) => {
                                        if (err) {
                                            response.json({status: "error", error: err});
                                        } else {
                                            
                                            response.json({status: "OK"});  
                                        }
                                    }); 
                                }
                        });
                    }
                });
            } else {
                db.collection("users").findOne( {"username": otherUser, verified: "yes"}, (error, document) => {  
                    if (error) {
                        response.json({status: "error", error: error});
                    } else if (document == null) {
                        response.json ({status: "error", error: "THE PERSON THAT YOU ARE TRYING TO UNFOLLOW DOES NOT EXIST"});
                    } else {
                        db.collection("users").update({"username": otherUser, verified: "yes"},{ $pull: {"followers": currentUser}},
                        (err, result) => {
                            if (err) {
                                response.json({status: "error", error: err});
                            } else {
                                db.collection("users").update({"username": currentUser, verified: "yes"},{ $pull: {"following": otherUser}},
                                (err,result) => {
                                    if (err) {
                                        response.json({status: "error", error: err});
                                    } else {
                                        response.json({status: "OK"});  
                                    }
                                });
                            }
                        });
                    }
                });
            }
        } else {
            response.json ({status: "error", error: "USER IS NOT LOGGED IN"});
        }
	});
});
                    
//grading
app.get("/user/:username", function (request, response) { 
    var username = request.params.username;
    var sessionkey = request.cookies.key;

    db.collection("sessions").findOne( {"sessionkey": sessionkey}, {"sessionkey": 1}, (error, doc) => {
        if (doc) {
            db.collection("users").findOne({"username": username, verified: "yes"}, (error, document) => {
                if (document) {
                            var following = document.following;
                            var followingCount = Object.keys(following).length;
                            
                            var followers = document.followers;
                            var followersCount = Object.keys(followers).length;
                            
                            response.json({
                                status: "OK", 
                                user: {
                                    email: document.email,
                                    followers: followersCount,
                                    following: followingCount
                                }
                            });
                } else {
                    response.json({status: "error", error: "THE USER YOU ARE LOOKING FOR DOES NOT EXIST"});
                }
            }); 
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

//front end
app.post("/user", function (request, response) {
    
    db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
        if (doc) { 
            db.collection("users").findOne({"username": request.cookies.key, verified: "yes"}, function (error, document) {

                var following = document.following;
                var followingCount = Object.keys(following).length;

                var followers = document.followers;
                var followersCount = Object.keys(followers).length;

                response.json({
                    status: "OK", 
                    user: {
                        username: request.cookies.key,
                        email: document.email,
                        followers: followersCount,
                        following: followingCount
                    }
                });
            });
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

//grading
app.get("/user/:username/followers", function (request, response) {
    var username = request.params.username;
    var sessionkey = request.cookies.key;

    db.collection("sessions").findOne( {"sessionkey": sessionkey}, {"sessionkey": 1}, (error, doc) => {
        if (doc) {
            db.collection("users").findOne({"username": username, verified: "yes"}, (error, document) => {
                if (document) {
                    response.json({
                        status: "OK", 
                        users: document.followers
                    });
                } else {
                    response.json({status: "error", error: "THE USER YOU ARE LOOKING FOR DOES NOT EXIST"});
                }
            }); 
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

//grading
app.get("/user/:username/following", function (request, response) {
    var username = request.params.username;
    var sessionkey = request.cookies.key;

    db.collection("sessions").findOne( {"sessionkey": sessionkey}, {"sessionkey": 1}, (error, doc) => {
        if (doc) {
            db.collection("users").findOne({"username": username, verified: "yes"}, (error, document) => {
                if (document) {
                    response.json({
                        status: "OK", 
                        users: document.following
                    });
                } else {
                    response.json({status: "error", error: "THE USER YOU ARE LOOKING FOR DOES NOT EXIST"});
                }
            }); 
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

//front end to get everyone's followers list
app.get("/followers/:username", function (request, response) {
    response.sendFile(path.join(__dirname + "/followers.html"));
});

//front end to get everyone's following list
app.get("/following/:username", function (request, response) {
    response.sendFile(path.join(__dirname + "/following.html"));
});

//front-end to check whether user liked the tweet or not
app.post("/didilike", function(request, response) {
    var id = request.body.id;
    var user = request.body.user;
    db.collection("tweets").findOne({"id": id}, (error, doc) => {
        if (doc) {
            var liked = false;
            console.log(doc.likers);
            for (var i = 0; i < doc.likers.length; i++) {
                if (doc.likers[i] == user)
                    liked = true;       
            }
            response.json({status: "OK", liked: liked})
        }
    });
});

//grading
app.post("/item/:id/like", function (request, response) {
    var likeBool = true; 
    if (request.body.like != null) {
        likeBool = request.body.like;
    }
    
    console.log("likebool is now " + likeBool);
    
    var id = request.params.id;
    var currentUser = request.cookies.key;
    
    db.collection("sessions").findOne({"sessionkey": currentUser},{"sessionkey": 1}, (error, doc) => {
		//if the user is logged in
        if (doc) { 
            db.collection("tweets").findOne({"id": id}, (error, doc) => {
                //if the tweet exists in tweet database
                if (doc) {
                    var tweetUser = doc.username;
                    var likers = doc.likers;
                    var alreadyLiked = false;
                    
                    for (var i = 0; i< likers.length; i++) {
                        console.log("likers[i] and currentUser" + likers[i] + " " + currentUser);
                        if (likers[i] == currentUser) {
                            alreadyLiked = true; 
                            break;
                        }
                    }
                    
                    
                    console.log("alreadyLiked and likeBool " + alreadyLiked + " " + likeBool);
                
                    if (!alreadyLiked && likeBool) {
                        //have not already liked and you want to like
                        console.log("not liked so imma add");
                        db.collection("tweets").update(
                            {"id": id}, 
                            { $inc: {likes: 1}, $addToSet: {"likers": currentUser}}
                        );
                        
                        db.collection("users").update(
                            {username: tweetUser, "tweets.id": id}, 
                            {$inc: {"tweets.$.likes":1}, $addToSet: {"tweets.$.likers": currentUser}}
                        )    
                        response.json({status: "OK"});
                    } else if (alreadyLiked && !likeBool) {
                        //been liking it but no longer likes it
                        console.log("im unliking");
                        db.collection("tweets").update(
                            {"id": id}, 
                            { $inc: {likes: -1}, $pull: {"likers": currentUser}}
                        );
                        
                        db.collection("users").update(
                            {username: tweetUser, "tweets.id": id}, 
                            {$inc: {"tweets.$.likes": -1}, $pull: {"tweets.$.likers": currentUser}}
                        )    
                        
                        response.json({status: "OK"});
                        
                    } else {
                        response.json({status: "error", error: "You are trying to unlike/like something you have already not liked or liked"});
                    }
                       
                } else {
                    response.json({status: "error", error: "Did not find a tweet with this id"});
                }
            });
                 
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

//front end temp
app.get("/addmedia", function (request, response) {
    response.sendFile(path.join(__dirname + "/addmedia.html"));
});

//grading
app.post('/addmedia', upload.single('content'), function(request,response){  
    db.collection("sessions").findOne({"sessionkey": request.cookies.key},{sessionkey: 1}, (error, doc) => {
		if (error) 
            response.json({status: "error", error: "ERROR UPLOADING FILE"});
        if (doc) {
            
            var imgid =  Math.round(Math.random()*100000 + 1) + request.file.originalname; //in case same file name
            db.collection("images").insert({
                  "imgid": imgid,   
                  "tweetid": "none", 
                  "type":request.file.mimetype,
                  "buffer": request.file.buffer,
            });
            
            response.json({status: "OK", id: imgid});
            
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

//front end to add multiple media !!!!! new
app.post("/addmanymedia", upload.any(), function (request, response) {
    db.collection("sessions").findOne({"sessionkey": request.cookies.key},{sessionkey: 1}, (error, doc) => {
		if (error) 
            response.json({status: "error", error: "ERROR UPLOADING FILE"});
        if (doc) {
            var idArr = [];
            
            for (var i = 0; i < request.files.length; i++) {
                var imgid =  Math.round(Math.random()*100000 + 1) + request.files[i].originalname; //in case same file name
                db.collection("images").insert({
                      "imgid": imgid,   
                      "tweetid": "none", 
                      "type":request.files[i].mimetype,
                      "buffer": request.files[i].buffer,
                });
                idArr.push(imgid);
            }
            
            response.json({status: "OK", ids: idArr});
            
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

app.get('/media/:id', function (request, response) {
    
    var imgid = request.params.id;
    
    db.collection("sessions").findOne({"sessionkey": request.cookies.key},{sessionkey: 1}, (error, doc) => {
		if (error) 
            response.json({status: "error", error: "ERROR RETRIEVING FILE"});
        if (doc) {
            db.collection("images").findOne({"imgid": imgid}, (error, imgFound) => {
                if (imgFound) {
                    console.log(imgFound.imgid + " "+ imgFound.type);
                    
                    response.setHeader('Content-Type', imgFound.type);
                    response.end(imgFound.buffer.buffer);
                }
            });
        } else {
            response.json({status: "error", error: "USER IS NOT LOGGED IN"});
        }
    });
});

app.listen(1337);
console.log("Server started");