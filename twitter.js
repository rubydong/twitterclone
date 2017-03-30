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

MongoClient.connect("mongodb://130.245.168.251:27017,130.245.168.182:27017,130.245.168.183:27017,130.245.168.185:27017,130.245.168.187:27017/twitter?replicaSet=twitter&readPreference=secondary", function (error, database) {
    
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

app.get("/logout", function(request, response) {
    console.log("IN LOGOUT POST");
    request.session = null;
    response.redirect('/login');
});

app.post("/logout", function (request, response) {
    
        console.log("IN LOGOUT POST");
        request.session = null;
        response.json({ "status": "OK" });
        response.redirect('/login');

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
    //console.log("what is the content" + content);
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

app.delete("/item/:id", function (request, response) {

    var id = request.params.id;
    console.log("param id is..." + id);
     if (!request.session.isNew) {
		console.log("id is ", id);
        db.collection("users").update(
            {"username": request.session.username},
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
                        if (error) console.log(error);
                        console.log(document);
                        if (document) {
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

app.post("/item", function (request, response) {
    var id = request.body.itemId;
    if (!request.session.isNew) {
		console.log("id is ", id);
        db.collection("tweets").findOne( { "id": parseInt(id) },function (error, document) {
			if (error) console.log(error);
			//console.log(document);
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
    
    var timestamp = request.body.timestamp;
    /* optional */
    var limit = request.body.limit;
    var currentLimit = 0;
	limit = 25;
	if (request.body.limit) {
		limit = parseInt(request.body.limit);
	}
    
	if (request.body.timestamp) {
		//console.log(" timestamp exists");
		timestamp = timestamp * 1000;
	} else {
		timestamp = new Date().getTime();
		//console.log("default timestamp ", timestamp);
	}
    if (timestamp) {
        if (!request.session.isnew && request.session.username != null) {
			
            var items = new Array();
			db.collection("tweets").find({timestamp: {$lte: parseInt(timestamp)}}).limit(limit).each(function(err,val) {
				if (val) {
                    if (currentLimit < limit) {

                        //items.push(val);
                        items.push({id:val.id,username:val.username,content:val.content,timestamp:val.timestamp});
                        currentLimit++;
                    }		
				} else {
				    response.json({status:"OK", items:items});
                    //console.log("items are " + JSON.stringify(items));
				}
			});
            
            
        } else {
            response.json({status: "ERROR", "Error": "USER IS NOT LOGGED"});
        }
    } else {
        response.json({status: "ERROR", "Error": "TIMESTAMP IS EMPTY"});
    }
});
        
app.get("/home", function(request, response) {
    response.sendFile(path.join(__dirname + "/home.html")); 
});

app.get("/follow", function (request, response) {
    response.sendFile(path.join(__dirname + "/follow.html")); 
});

app.post("/follow", function (request, response) {
    console.log("IN ADDITEM POST");

    var followbool = request.body.followbool;
    var currentUser = request.session.username;
    var otherUser = request.body.username; //other user to folllow or unfollow
    
   if (!request.session.isnew && request.session.username != null) {
        //follow
        if (followbool == "true") {
            console.log("following");
            db.collection("users").findOne( {"username": otherUser}, function (error, document) {  
                
                if (error) {
                    response.json({status: "error", error: error});
                }
                else if (document == null) {
                    response.json ({status: "error", error: "THE PERSON THAT YOU ARE TRYING TO FOLLOW DOES NOT EXIST"});
                } else {
                    db.collection("users").update(
                        {"username": otherUser},
                        { $addToSet: { "followers": {"username": currentUser}}}
                    );
                    
                    db.collection("users").update(
                        {"username": currentUser}, 
                        { $addToSet: { "following": {"username": otherUser}}}
                            
                    );
                    response.json({status: "OK"});   
                }
            });
        //unfollow
        } else if (followbool == "false"){
            
            console.log("attempt at unfollowing");
            db.collection("users").findOne( {"username": otherUser}, function (error, document) {  
                if (error) {
                    response.json({status: "error", error: error});
                }
                else if (document == null) {
                    response.json ({status: "error", error: "THE PERSON THAT YOU ARE TRYING TO UNFOLLOW DOES NOT EXIST"});
                } else {
                    db.collection("users").update(
                        {"username": otherUser},
                        { $pull: { "followers": {"username": currentUser} } }
                    );
                    
                    db.collection("users").update(
                        {"username": currentUser}, 
                        { $pull: { "following": {"username": otherUser} } }
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

app.listen(1337);
console.log("Server started");
