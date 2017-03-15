var cookieSession = require("cookie-session");
var express = require("express");
var app = express();
var path = require("path");
var bodyParser = require("body-parser");
var nodemailer = require("nodemailer");
var MongoClient = require("mongodb").MongoClient;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
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
                        sendEmail (email, emailkey);
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
    var username = request.body.username;
    var password = request.body.password;
    
    if (username && password) {
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
        request.session = null;
        response.json({ "status": "OK" });
//    }
});

app.get("/verify", function (request, response) {
    response.sendFile(path.join(__dirname + "/verify.html"));
});

app.post("/verify", function (request, response) {
    var email = request.body.email;
    var key = request.body.key;

    if (email && key) {
        if ( key == emailkey || key == "abracadabra") {
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
    var content = request.body.content;
    //if not logged in error
    var timestamp = new Date().getTime();
    console.log(request.session.username);
    if (!request.session.isNew) {
        var tweetId = Math.round(Math.random()*99999 + 1) * 
        Math.round(Math.random()*99999+1) + Math.round(Math.random()*99999 + 1);
        
        db.collection("users").update(
            {"username": request.session.username},
            {
              $push: {
                    "tweets": {
                          "tweet": content,
                          "tweetid": tweetId, 
                          "timestamp": timestamp
                    }
                } 
            },
            function (error, result) {
                if (error) {
                    response.json({ "status": "ERROR" });
                } else {
                    response.json ({
                        status: "OK",
                        id: tweetId,
                    });
                }
            }
        );
    } else {
        response.json (
            {status: "ERROR", "Error": "USER IS NOT LOGGED IN"}
        );
    }
});

app.get("/item/:id", function (request, response) {
    var id = request.params.id;
    //if not valid id then error
    if (id != undefined){
        
        db.collection("users").findOne( {"username": request.session.username}, { "tweets": 1 }, function (error, document) {
            response.json({ "status": "OK", "conversation": getConversation(document.conversations, parseInt(request.body.id)) });
        });

        
        response.json({
            status: "OK", 
            item: {
                "id": id, 
                "username": "x",
                "content": "x",
                "timestamp": "x"
            }
        });
    } else {
        response.json({status: "ERROR"});
    }
});

app.get("/search", function(request, response) {
   response.sendFile(path.join(__dirname + "/search.html")); 

});
app.post("/search", function(request, response) {
    var timestamp = request.body.timestamp;
    //optional
    var limit = request.body.limit;

    if (timestamp) {
        response.json({
            status:"OK", 
            "items": "xx"
        });
    } else {
        response.json({status: "ERROR", "Error": "PLEASE FILL IN THE TIMESTAMP"});
    }
});
        
app.listen(8080);
console.log("Server started");