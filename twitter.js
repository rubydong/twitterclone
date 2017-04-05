var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var nodemailer = require("nodemailer");
var cookieParser = require("cookie-parser");
var MongoClient = require("mongodb").MongoClient;

var app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use(cookieParser());
app.set("trust proxy", 1); //Trust first proxy

/*
	TRY TO MODULARIZE THIS GIANT CHUNK



*/



MongoClient.connect("mongodb://130.245.168.187:27017/twitter", (err,database) => {
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
    console.log("IN ADDUSER POST");

    var e_username = req.body.username;
    var e_password = req.body.password;
    var e_email = req.body.email;    
    var e_emailkey = (Math.random() + 1).toString(36).substring(7);
    
    if (e_username && e_password && e_email) {
        //check if username/email has been taken already
        db.collection("users").findOne({$or: [{username: e_username},{email: e_email}]},
                                       {conversations: 1}, (err, doc) => {
            if (doc) {
                res.json({status: "ERROR", error: "USERNAME/EMAIL EXISTS"});
            } else {
                var newuser = {
                    "username": e_username,
                    "password": e_password,
                    "email": e_email,
                    "verified": e_emailkey, 
                    "tweets": [],
                    "followers": [],
                    "following": []
                };
                db.collection("users").insert(newuser,{w:1}, (err, user) => {
                    if (err)
                        console.error(new Error("ERROR inserting newuser", err));
                    else
                        res.json({status: "OK"});
                });
            }
        });
    } else {
        res.json({status: "ERROR", error: "PLEASE FILL IN ALL FIELDS"});
    }
});
        
//front end
app.get("/login", function (request, response) {            
    response.sendFile(path.join(__dirname + "/login.html"));
});

//grading
app.post("/login", function (request, response) {
    console.log("IN LOGIN POST");

    var username = request.body.username;
    var password = request.body.password;
    
    if (username && password) {
		console.log("Attempt login with user: %s pass: %s", username, password);
        db.collection("users").findOne({"username": username,"password": password}, {"name": 1}, (error, doc) => {
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
                response.json({status:"ERROR", error: "INVALID LOGIN"});
            }
        });
    } else {
        response.json({status: "ERROR", error: "PLEASE FILL IN ALL FIELDS"});
    }
});

//front end
app.get("/logout", function(request, response) {

    console.log("IN LOGOUT GET");
    request.session = null;
	console.log(request.cookies.key);
		db.collection("sessions").remove({"sessionkey": request.cookies.key},1);
		response.clearCookie("key");
		console.log(request.cookies.key);
    //response.redirect('/login');
});

//grading
app.post("/logout", function (request, response) {
        console.log("IN LOGOUT POST");

		db.collection("sessions").remove({"sessionkey": request.cookies.key},1, (err) => {
            if (err) {
                console.error(new Error("ERROR deleting session key"));
                response.json({status: "ERROR"});
            } else {
        		console.log("USER",request.cookies.key, "logged out");
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
	console.log("IN VERIFY POST");

    var e_email = req.body.email;
    var e_key = req.body.key;
    var e_emailkey = "";

    if (e_email && e_key) {
        db.collection("users").findOne({email: e_email}, (err, doc) => {
            if (err) { 
                console.error(new Error("DID NOT FIND USER:", e_email, err));
                res.json({status: "ERROR"});
            } else if (doc) {
                e_emailkey = doc.verified;
                if (e_key == e_emailkey || e_key == "abracadabra") {
                    db.collection("users").update({email: e_email},{$set: {verified: "yes" }},
                        {w:1}, (err,result) => {
                            if (err) {
                                console.error(new Error("VERIFY FAILED", err))
                                res.json({status: "ERROR"});
                            } else {
                                res.json({status:"OK"});
                            }
                        });
                } else { 
                    res.json({status: "ERROR", error: "INVALID KEY PLEASE TRY AGAIN"});
                }
            } else {
                res.json({status: "ERROR", error: "No email found"});
            }
        });
    } else {
        res.json({status: "ERROR", error: "PLEASE FILL IN ALL FIELDS"});
    }
});

//grading
app.post("/additem", function (req, res) {
    console.log("IN ADDITEM POST");

    var content = req.body.content;
    var timestamp = new Date().getTime();

	db.collection("sessions").findOne({sessionkey: req.cookies.key},{sessionkey: 1}, (error, doc) => {
		if (doc) {
            var id = Math.round(Math.random()*99999+1)*
                     Math.round(Math.random()*99999+1)+
                    Math.round(Math.random()*99999+1);

            db.collection("users").update({username: req.cookies.key},
                {
                  $push: {
                        "tweets": {
                              "id": id,   
                              "username": req.cookies.key,
                              "content": content,
                              "timestamp": timestamp
                        }
                    } 
                }, (error, result) => {
                    if (error) {
                        console.error(new Error("ERROR INSERTING TWEET TO", req.cookies.key));
                        res.json({status: "ERROR" });
                    } else {
                        var document = {
                            "id": id,   
                            "username": req.cookies.key,
                            "content": content,
                            "timestamp": timestamp
                        };
                        
                        db.collection("tweets").insert(document, {w: 1}, (error, result) => {
    							if (error) {
    								console.error(new Error("ERROR INSERTING TWEET TO DB"));
                                    res.json({status: "ERROR"});
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
    console.log("IN ITEM/:id GET");

    var id = request.params.id;
    //console.log("param id is.." + id);
	db.collection("sessions").findOne({sessionkey: request.cookies.key}, {sessionkey: 1}, (error, doc) => {
        if (doc) {
            db.collection("tweets").findOne({id: parseInt(id)}, (error, document) => {
                if (error) {
                    console.error(new Error("ERROR SEARCHING FOR TWEET WITH ID"));
                    response.json({status: "ERROR"});
                } else if (document) {
                    response.json(
                        {
                            status: "OK",
                            item: {
                                id: document.id,
                                username: document.username,
                                content: document.content,
                                timestamp: document.timestamp
                            }
                        });
                } else {
                    console.error(new Error("NO TWEET FOUND WITH ID"));
                    response.json({status: "ERROR"});
                }
            });
        } else {
            console.error(new Error("NO SESSION AVAILABLE"));
            response.json({status: "ERROR"});
        }
    });
});
//});

//grading
app.delete("/item/:id", function (request, response) {
    console.log("IN ITEM/:id DELETE");

    var id = request.params.id;
	db.collection("sessions").findOne({"sessionkey": request.cookies.key},{"sessionkey": 1},(error, doc) => {
        if (doc) {
            db.collection("users").update({"username": request.cookies.key},
                {
                  $pull: {"tweets": { "id": parseInt(id)}} 
                }, (error, result) => {
                    if (error) {
                        console.error(new Error("ERROR UPDATING TWEET"));
                        response.json({status: "ERROR" });
                    } else {
                        db.collection("tweets").findOne( {"id": parseInt(request.params.id) }, (error, document) => {
                            if (error) {
                                console.error(new Error("ERROR FINDING TWEET WITH ID"));
                                response.json({status: "ERROR"});
                            } else if (document) {
                                if (document.username == request.cookies.key) {
                                    db.collection("tweets").remove({"id": parseInt(id)}, 1, (error, result) => {
                                        if (error) {
                                            console.error(new Error("ERROR REMOVING TWEET"));
                                            response.json({status:"ERROR"});
                                        } else {
                                            response.json({status: "OK"});
                                        }
                                    });
                                } else {
                                    console.error(new Error("DID NOT FIND TWEET WITH ID"));
                                    response.json({status: "ERROR"});
                                }
                            } else {
                                console.error(new Error("DID NOT FIND TWEET WITH ID"));
                                response.json({status: "ERROR"});
                            }
                        });
                    }
            });
        } else {
            console.error(new Error("NO SESSION FOUND"));
            response.json({status: "ERROR"});
        }
	});
});

//front end
app.post("/item", function (request, response) {
    var id = request.body.itemId;
		//db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
		//if (doc) {
		if (request.cookies.key != null) {
		console.log("POST id is ", id);
        db.collection("tweets").findOne( { "id": parseInt(id) },function (error, document) {
			if (error) { console.log(error); }
			
            else if (document) {
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
        response.json ({status: "error", msg: "USER IS NOT LOGGED IN"});
});


//grading
function checkConditions(tweets, query, timestamp) {
	if (tweets.content.indexOf(query) == -1)
		return false;
	else if (tweets.timestamp > timestamp)
		return false;
	else
		return true;
}

app.post("/search", function(req, res) {
	console.log("IN SEARCH POST");
    // console.log(req)

	var timestamp = new Date().getTime();
	var limit = 25;
	var query = '';
	var username = req.body.username;
	var following = true;
	var limitCounter = 0;

	if (req.body.limit) {
		limit = parseInt(req.body.limit);
	}
	if (req.body.timestamp)
		timestamp = parseInt(req.body.timestamp) * 1000;
	if (req.body.q)
		query = req.body.q;
	if (req.body.following)
		following = req.body.following;

	db.collection("sessions").findOne({"sessionkey": req.cookies.key},{"sessionkey": 1}, (error, doc) => {
		if (doc) {
			tweetsArr = new Array();

            if (following == true) {
                console.log("FOLLOWING IS TRUE");

                if (username) {
                    console.log("USERNAME IS INPUTTED")
                    db.collection("users").findOne({"username": req.cookies.key, "following": { $in: [username] }}, (error, loggeduser) => {
                        if (loggeduser) {
                            console.log(req.cookies.key, "IS FOLLOWING", username);


                            db.collection("users").findOne({"username": username}, (error, followinguser) => {
                                if (followinguser) {
                                    var tweets = followinguser.tweets;

                                    for (var i = 0; i < tweets.length && limitCounter < limit; i++) {
                                        if ( (tweets[i].content.indexOf(query) != -1) && 
                                             (tweets[i].timestamp <= timestamp)) {
                                            tweetsArr.push({
                                                id: tweets[i].id,
                                                username: tweets[i].username,
                                                content: tweets[i].content,
                                                timestamp: tweets[i].timestamp
                                            });
                                            limitCounter++;
                                        }
                                    }
                                    console.log("RETURNING", tweetsArr.length, "TWEETS");
                                    res.json({status: "OK", items: tweetsArr});

                                } else {
                                    console.log(username, "WAS NOT FOUND");
                                    res.json({status: "ERROR", error: "USER WAS NOT FOUND"});
                                }
                            });
                        } else {
                            console.log(req.cookies.key, "IS NOT FOLLOWING", username);
                            res.json({status: "OK", items: [] });
                        }
                    });
                } else {
                    db.collection("users").findOne({username: req.cookies.key}, (err, user) => {
                        if (user) {
                            var follow = user.following;
                            console.log("FOLLOWING", follow);
                            db.collection("users").find({username:{$in: follow}}).toArray((err,val) => {
                                    console.log("Number returned from toArray", val.length);
                                    // var tweets = val.tweets;

                                    for (var i = 0; i < val.length && limitCounter < limit; i++) {
                                        var tweets = val[i].tweets;

                                        for (var j = 0; j < tweets.length && limitCounter < limit; j++) {
                                            if ( (tweets[i].content.indexOf(query) != -1) && 
                                                 (tweets[i].timestamp <= timestamp)) {
                                                tweetsArr.push({
                                                    id: tweets[i].id,
                                                    username: tweets[i].username,
                                                    content: tweets[i].content,
                                                    timestamp: tweets[i].timestamp
                                                });
                                                limitCounter++;
                                            }
                                        }
                                    }

                                    res.json({status: "OK", items: tweetsArr});
                            });
                        } else {
                            res.json({status: "ERROR",error: "USER IS NOT FOUND"});
                        }
                    });
                }
            } else {
                console.log("FOLLOWING IS FALSE");
                 db.collection("tweets").find(
                 {$and: [
                     {content: {$regex: query }},
                     {timestamp: {$lte: timestamp}}
                     ]
                 }).limit(limit).toArray((err, val) => {
                        console.log("Number returned from toArray", val.length);

                        for (var i = 0; i < val.length; i++) {
                            if (limitCounter < limit) {
                                tweetsArr.push(val[i]);
                                limitCounter++;
                            } else {
                                break;
                            }
                        }
                        console.log("Number of tweets", tweetsArr.length);
                        // console.log(tweetsArr);
                        res.json({status: "OK",items: tweetsArr});
                 });
            }




			// if (username) {
			// 	db.collection("users").findOne({"username": username}, (error, user) => {
			// 		if (user) {
			// 			var tweets = user.tweets;

			// 			for (var i = 0; i < tweets.length && limitCounter <= limit; i++) {
			// 				if (checkConditions(tweets[i],query,timestamp)) {
			// 					tweetsArr.push({
			// 						id: tweets[i].id,
			// 						username: tweets[i].username,
			// 						content: tweets[i].content,
			// 						timestamp: tweets[i].timestamp
			// 					});
			// 					limitCounter++;
			// 				}
			// 			}
   //                      console.log("Number of tweets", tweetsArr.length);
			// 			res.json({status: "OK",items: tweetsArr});
			// 		} else {
			// 			res.json({status: "ERROR",error: "USER IS NOT FOUND"});
			// 		}
			// 	});
			// } else {
			// 	if (following == true) {
   //                  console.log("FOLLOWING IS TRUE");
			// 		db.collection("users").findOne({username: req.cookies.key}, (err, user) => {
   //                      if (user) {
   //  						var follow = user.following;
   //                          console.log("FOLLOWING", follow);
   //  						db.collection("tweets").find({username:{$in: follow}}).limit(limit).toArray((err,val) => {
   //                              console.log("Number returned from toArray", val.length);

   //                              for (var i = 0; i < val.length; i++) {
   //                                  if (limitCounter < limit) {
   //                                      tweetsArr.push(val[i]);
   //                                      limitCounter++;
   //                                  } else {
   //                                      break;
   //                                  }
   //                              }
   //                              console.log("Number of tweets", tweetsArr.length);
   //                              res.json({status: "OK",items: tweetsArr});
   //  						});
   //                      } else {
   //                          res.json({status: "ERROR",error: "USER IS NOT FOUND"});
   //                      }
			// 		});
			// 	} else {
   //                  console.log("FOLLOWING IS FALSE");
			// 		db.collection("tweets").find(
			// 		{$and: [
			// 			{content: {$regex: query }},
			// 			{timestamp: {$lte: timestamp}}
			// 			]
			// 		}).limit(limit).toArray((err, val) => {
   //                      console.log("Number returned from toArray", val.length);

   //                      for (var i = 0; i < val.length; i++) {
   //                          if (limitCounter < limit) {
   //                              tweetsArr.push(val[i]);
   //                              limitCounter++;
   //                          } else {
   //                              break;
   //                          }
   //                      }
   //                      console.log("Number of tweets", tweetsArr.length);
   //                      // console.log(tweetsArr);
   //                      res.json({status: "OK",items: tweetsArr});
			// 		});
			// 	}
			// }
		} else {
			res.json({status: "ERROR",error: "USER IS NOT LOGGED IN"});
		}
	});
});

//front end
app.get("/follow", function (request, response) {
    response.sendFile(path.join(__dirname + "/follow.html")); 
});

//grading
app.post("/follow", function (request, response) {
    console.log("IN FOLLOW POST");

    var followbool = request.body.followbool;
    
	db.collection("sessions").findOne({"sessionkey": request.cookies.key},{"sessionkey": 1}, (error, doc) => {
		if (doc) { 
            var currentUser = request.cookies.key;
            var otherUser = request.body.username; //other user to folllow or unfollow

            if (followbool == "true") {
                db.collection("users").findOne({"username": otherUser}, (error, document) => {  
                    if (error) {
                        response.json({status: "error", error: error});
                    } else if (document == null) {
                        response.json({status: "error", error: "THE PERSON THAT YOU ARE TRYING TO FOLLOW DOES NOT EXIST"});
                    } else {
                        db.collection("users").update({"username": otherUser},{ $addToSet: {"followers": currentUser}},
                            (err, result) => {
                                if (err) {
                                    response.json({status: "error", error: err});
                                } else {
                                    db.collection("users").update({"username": currentUser},{$addToSet: {"following":otherUser}},
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
            } else if (followbool == "false"){
                db.collection("users").findOne( {"username": otherUser}, (error, document) => {  
                    if (error) {
                        response.json({status: "error", error: error});
                    } else if (document == null) {
                        response.json ({status: "error", error: "THE PERSON THAT YOU ARE TRYING TO UNFOLLOW DOES NOT EXIST"});
                    } else {
                        db.collection("users").update({"username": otherUser},{ $pull: {"followers": currentUser}},
                        (err, result) => {
                            if (err) {
                                response.json({status: "error", error: err});
                            } else {
                                db.collection("users").update({"username": currentUser},{ $pull: {"following": otherUser}},
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
            } else {
                response.json({status: "error", error: "USER DID NOT ENTER CORRECT PARAMETERS"});
            }
        } else {
            response.json ({status: "error", error: "USER IS NOT LOGGED IN"});
        }
	});
});
                    
//grading
app.get("/user/:username", function (request, response) {
    console.log("IN /USER/:username GET");
    
    var username = request.params.username;

    db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, (error, doc) => {
        if (doc) {
            db.collection("users").findOne({"username": username}, (error, document) => {
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
            db.collection("users").findOne({"username": request.cookies.key}, function (error, document) {

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
    console.log("IN USER/:username/FOLLOWERS GET");

    var username = request.params.username;

    db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, (error, doc) => {
        if (doc) {
            db.collection("users").findOne({"username": username}, (error, document) => {
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
    console.log("IN USER/:username/following GET");
    
    var username = request.params.username;

    db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, (error, doc) => {
        if (doc) {
            db.collection("users").findOne({"username": username}, (error, document) => {
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

app.listen(1337);
console.log("Server started");
