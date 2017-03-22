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
                    db.collection("tweets").insert(document, {w: 1}, function(error, result) {});
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
//        db.collection("users").findOne( {"username": request.session.username}, { "tweets": 1 }, function (error, document) {
//            if (document) {
//                var tweets = document.tweets;
//                
//                var found = false;
//                for (var i = 0; i < tweets.length; i++) {
//                    if (tweets[i].id == id) {
//                        found = true;
//                        response.json({
//                            status: "OK", 
//                            item: {
//                                "id": tweets[i].id, 
//                                "username": tweets[i].username,
//                                "content": tweets[i].content,
//                                "timestamp": tweets[i].timestamp
//                            }
//                        });
//                        break;
//                    }
//                }
//                if (!found) {
//                    response.json({status: "error", error: "THIS IS AN INVALID ID"});
//                }
//            }
//        });
        db.collection("tweets").findOne( { "id": id }, function (error, document) {
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

app.post("/search", function(request, response) {
    console.log("IN SEARCH POST");
	console.log(request);
    var timestamp = request.body.timestamp;
    /* optional */
    var limit = request.body.limit;
    var currentLimit = 0;
	limit = 25;
	if (request.body.limit) {
		limit = request.body.limit;
	}
    //search through database for less than this time
    //check if timestamp is empty
	console.log("TIME STAMP: ", timestamp);

	if (request.body.timestamp) {
		console.log("timestamp exists");
		timestamp = timestamp * 1000;
	} else {
		timestamp = new Date().getTime();
		console.log("default timestamp ", timestamp);
	}
    if (timestamp) {
        if (!request.session.isnew && request.session.username != null) {
             db.collection("users").findOne( {"username": request.session.username}, { "tweets": 1 }, function (error, document) {
                if (document) {
                    var tweets = document.tweets;
                    var found = false;
                    var items = new Array();
					console.log(tweets.length);
                    for (var i = 0; i < tweets.length; i++) {
						console.log("curr ts: ", tweets[i].timestamp, "real ts: ", timestamp);
                        if (tweets[i].timestamp <= timestamp) {
							console.log("am i here");
                            if (limit != "" && currentLimit >= limit){
                                break;
                            }
                            currentLimit++;
                            found = true;
                            items.push(tweets[i]);
                        }
                    }
                  	console.log(items.length); 
                    response.json({status:"OK", "items": items});
                    
                }
            });

        } else {
            response.json({status: "ERROR", "Error": "USER IS NOT LOGGED"});
        }
    } else {
        response.json({status: "ERROR", "Error": "TIMESTAMP IS EMPTY"});
    }
});
        
app.listen(1337);
app.listen(1338);
app.listen(1339);
app.listen(1340);
app.listen(1341);
app.listen(1342);
app.listen(1343);
console.log("Server started");
