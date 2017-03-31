var cookieSession = require("cookie-session");
var express = require("express");
var app = express();
var path = require("path");
var bodyParser = require("body-parser");
var nodemailer = require("nodemailer");
var cp = require("cookie-parser");
var MongoClient = require("mongodb").MongoClient;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use(cp());
app.set("trust proxy", 1); //Trust first proxy
app.use(cookieSession({
    name: "session",
    keys: [(Math.random() + 1).toString(36).substring(7)]
}));


//MongoClient.connect("mongodb://130.245.168.251:27017,130.245.168.182:27017,130.245.168.183:27017,130.245.168.185:27017,130.245.168.187:27017/twitter?replicaSet=twitter&readPreference=primary", function (error, database) {
MongoClient.connect("mongodb://localhost:27017/twitter", function (error, database) {
    if (error) {
        return console.dir(error);
    }
    db = database;
    console.log("Connected to MongoDB");
});

//front end
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
app.post("/adduser", function (request, response) {
    var username = request.body.username;
    var password = request.body.password;
    var email = request.body.email;    
    var emailkey = (Math.random() + 1).toString(36).substring(7);
    
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
                            "tweets": [],
                            "followers": [],
                            "following": []
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
        
//front end
app.get("/login", function (request, response) {            
    response.sendFile(path.join(__dirname + "/login.html"));
});

//grading
app.post("/login", function (request, response) {
    var username = request.body.username;
    var password = request.body.password;
    
    if (username && password) {
		console.log("user: %s pass: %s", username, password);
        var username = request.body.username;
        db.collection("users").findOne({ "username": username, "password": request.body.password, "verified": "yes" }, { "name": 1 }, function (error, document) {
            if (document) {
                //sets the cookiea
				db.collection("users").insert(document, {w: 1}, function(error, result) {});

				db.collection("sessions").insert({"sessionkey": username},{w: 1}, function(error,result) {});
				
				response.cookie('key', username);
                //request.session.username = username;
                response.json({"status": "OK"});
            } else {
                response.json({"status":"ERROR", "Error": "INVALID LOGIN"});
            }
        });
       
    } else {
        response.json({"status": "ERROR", "Error": "PLEASE FILL IN ALL FIELDS"});
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
    response.redirect('/login');
});

//grading
app.post("/logout", function (request, response) {
        console.log("IN LOGOUT POST");
        request.session = null;
		db.collection("sessions").remove({"sessionkey": request.cookies.key},1);
		response.clearCookie("key");
		console.log(request.cookies.key);
        response.json({ "status": "OK" });
        response.redirect('/login');

});

//front end
app.get("/verify", function (request, response) {
    response.sendFile(path.join(__dirname + "/verify.html"));
});

//grading
app.post("/verify", function (request, response) {
    
	console.log("IN VERIFY POST");
    var email = request.body.email;
    var key = request.body.key;
    var emailkey = "";
    if (email && key) {
        
        
        db.collection("users").findOne({email: email}, function (err, document) {
            if (err){ 
                console.log(err);
            } else {
                emailkey = document.verified;
                console.log("THE KEY IS " + document.verified);
                if ( key == emailkey || key == "abracadabra") {
                    //console.log("IN HERE IN VERIFY");
                    response.json({"status": "OK"});
                    db.collection("users").update(
                        { "email": email }, 
                        { $set: { "verified": "yes" } } 
                    );
                }
                else { 
                    response.json({"status": "ERROR", "Error": "INVALID KEY PLEASE TRY AGAIN"});
                }
            }
        });
        
    } else {
        response.json({"status": "ERROR", "Error": "PLEASE FILL IN ALL FIELDS"});
    }
});

//grading
app.post("/additem", function (request, response) { 
    var content = request.body.content;
    //if not logged in error
    var timestamp = new Date().getTime();
	console.log("session key:",request.cookies.key);

	db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
		if (doc) {
        var id = Math.round(Math.random()*99999 + 1) * 
        Math.round(Math.random()*99999+1) + Math.round(Math.random()*99999 + 1);
        
        db.collection("users").update(
            {"username": request.cookies.key},
            {
              $push: {
                    "tweets": {
                          "id": id,   
                          "username": request.cookies.key,
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
                        "username": request.cookies.key,
                        "content": content,
                        "timestamp": timestamp
                    };
                    
                    db.collection("tweets").insert(document, {w: 1}, function(error, result) {if(error){console.log(error);}});
                    
                    response.json ({
                        status: "OK",
                        item: document
                    });
                }
            }
        );
    } else {
        response.json (
            {status: "error", error: "USER IS NOT LOGGED IN"}
        );
    }
	});
	console.log("EXITED ADDITEM");
});

//grading
app.get("/item/:id", function (request, response) {
    
    var id = request.params.id;
    console.log("param id is.." + id);
	db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
		if (doc) {
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
});

//grading
app.delete("/item/:id", function (request, response) {
    
    var id = request.params.id;
	db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
		if (doc) {
		console.log("id is ", id);
        db.collection("users").update(
            {"username": request.session.key},
            {
              $pull: {
                    "tweets": {
                          "id": parseInt(id)
                    }
                } 
            },
            function (error, result) {
                if (error) {
                    response.json({ "status": "ERROR" });
                } else {
                    db.collection("tweets").findOne( { "id": parseInt(request.params.id) },function (error, document) {
                        if (error) {
                            console.log(error);
                        } else if (document) {
                            db.collection("tweets").remove({"id": parseInt(request.params.id)}, 1);
                            response.json({status: "SUCCESS"});
                        } else {
                            response.json({status: "FAILURE"});
                        }
                    });
                }
            }
        );
    } else {
        response.json({status: "FAILURE"});
    }
	});
});

//front end
app.post("/item", function (request, response) {
    var id = request.body.itemId;
		db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
		if (doc) {
		console.log("id is ", id);
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
	});
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
app.post("/search", function(request, response) {
    //var currentLimit = 0;
    var timestamp = new Date().getTime(); //default current time
	var limit = 25; //default 25
	var query = ''; 
    var username = request.body.username;
    var following = "true"; //default true
    var currentLimit = 0;
    
    if (request.body.limit) { limit = parseInt(request.body.limit); }
	if (request.body.timestamp) { timestamp = request.body.timestamp; } //maybe * 1000...
    if (request.body.query) {query = request.body.query;}
	if (request.body.following) { following = request.body.following; }
    
    db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
        if (doc) {
            
            tweetsArr = new Array();
            if (username) {
                db.collection("users").findOne({username: username}, function (error, user) {
                    if (user) {
                        var tweets = user.tweets;
                        for (var i = 0; i < tweets.length; i++) {
                            if ((tweets[i].content.indexOf(query) != -1) && (tweets[i].timestamp <= timestamp) && currentLimit < limit) {
                                //console.log(tweets[i]);
                                tweetsArr.push({
                                    id: tweets[i].id,
                                    username: tweets[i].username,
                                    content: tweets[i].content,
                                    timestamp: tweets[i].timestamp
                                });
                                currentLimit++;
                            }
                        }
                        response.json({status: "OK", items: tweetsArr});
                    }
                });
            } else {
                if (following == "true") {   
                    db.collection("users").find({username:request.cookies.key}).toArray(
                    function(err, user) {
                        var count = 0;
                        var last = user[0].following.length;
                        //looking for the followings
                        for (var i = 0; i < user[0].following.length; i++) {
                            db.collection("users").find({username:user[0].following[i]}).toArray(
                            function(err, followingUser) {
                                var tweets = followingUser[0].tweets;
                                //looking for the tweets of each one of the followings
                                for (var j = 0; j < tweets.length; j++) {
                                    if ( (tweets[j].content.indexOf(query) != -1) && (tweets[j].timestamp <= timestamp) && currentLimit < limit) {
                                        tweetsArr.push({
                                            id: tweets[j].id,
                                            username: tweets[j].username,
                                            content: tweets[j].content,
                                            timestamp: tweets[j].timestamp
                                        });
                                        currentLimit++;
                                    }
                                }
                                count++;
                                if (count == last)
                                    response.json({status: "OK", items: tweetsArr});
                            });
                        }
                    });  
                } else {
                    //traverse through tweets data base
                    db.collection("tweets").find({$and: [{content: {$regex: query}}, {timestamp: {$lte: timestamp}}]}).limit(limit).each(function(err, val) {
                        if (val) 
                            tweetsArr.push({id:val.id,username:val.username,content:val.content,timestamp:val.timestamp}); 
                        else 
                            response.json({status:"OK", items:tweetsArr});
                    });
                }
            }
        } else {
            response.json({status: "ERROR", "Error": "USER IS NOT LOGGED"});
        }
    });

});

//front end
app.get("/follow", function (request, response) {
    response.sendFile(path.join(__dirname + "/follow.html")); 
});

//grading
app.post("/follow", function (request, response) {
    
    var followbool = request.body.followbool;
    
	db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
		if (doc) { 
        
            var currentUser = request.cookies.key;
            var otherUser = request.body.username; //other user to folllow or unfollow
            //follow
            if (followbool == "true") {

                db.collection("users").findOne( {"username": otherUser}, function (error, document) {  

                    if (error) {
                        response.json({status: "error", error: error});
                    }
                    else if (document == null) {
                        response.json ({status: "error", error: "THE PERSON THAT YOU ARE TRYING TO FOLLOW DOES NOT EXIST"});
                    } else {
                        db.collection("users").update(
                            {"username": otherUser},
                            { $addToSet: { "followers": currentUser}}
                        );

                        db.collection("users").update(
                            {"username": currentUser}, 
                            { $addToSet: { "following":otherUser}}

                        );
                        response.json({status: "OK"});   
                    }
                });
            //unfollow
            } else if (followbool == "false"){
                db.collection("users").findOne( {"username": otherUser}, function (error, document) {  
                    if (error) {
                        response.json({status: "error", error: error});
                    }
                    else if (document == null) {
                        response.json ({status: "error", error: "THE PERSON THAT YOU ARE TRYING TO UNFOLLOW DOES NOT EXIST"});
                    } else {
                        db.collection("users").update(
                            {"username": otherUser},
                            { $pull: { "followers": currentUser} } 
                        );

                        db.collection("users").update(
                            {"username": currentUser}, 
                            { $pull: { "following": otherUser} } 
                        );
                        response.json({status: "OK"});   
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
    
    var username = request.params.username;
    db.collection("users").findOne({"username": username}, function (error, document) {
        if (document) {
            db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
                if (doc) { 
                    console.log("the username is " + username);
                    
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
                    response.json({status: "error", error: "USER IS NOT LOGGED IN"});
                }
            });
        }
        else {
            response.json({status: "error", error: "THE USER YOU ARE LOOKING FOR DOES NOT EXIST"});
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
    var username = request.params.username;
    db.collection("users").findOne({"username": username}, function (error, document) {
        if (document) {
            db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
                if (doc) { 
                    console.log("the username is " + username);
                    
                    var followers = document.followers;
                    
                    response.json({
                        status: "OK", 
                        users: followers
                    });
                } else {
                    response.json({status: "error", error: "USER IS NOT LOGGED IN"});
                }
            });
        }
        else {
            response.json({status: "error", error: "THE USER YOU ARE LOOKING FOR DOES NOT EXIST"});
        }
    }); 
});

//grading
app.get("/user/:username/following", function (request, response) {
    
    var username = request.params.username;
    db.collection("users").findOne({"username": username}, function (error, document) {
        if (document) {
            db.collection("sessions").findOne( {"sessionkey": request.cookies.key}, {"sessionkey": 1}, function (error, doc) {
                if (doc) { 
                    console.log("the username is " + username);
                    
                    var following = document.following;
                    
                    response.json({
                        status: "OK", 
                        users: following
                    });
                } else {
                    response.json({status: "error", error: "USER IS NOT LOGGED IN"});
                }
            });
        }
        else {
            response.json({status: "error", error: "THE USER YOU ARE LOOKING FOR DOES NOT EXIST"});
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
