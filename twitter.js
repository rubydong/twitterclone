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


var emailKey = ""; //For email verification


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
   
    /*Error checking if username/email has been taken already*/
    if (username && password && email) {
        sendEmail (email, emailkey);
        
        response.json({"status": "OK"});
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
    console.log (username + " " + password);
    
    /*sets cookie*/
    /*Error checking if it is the right login from database*/
    if (username && password) {
        response.json({"status": "OK"});
    } else {
        response.json({"status": "ERROR", "Error": "PLEASE FILL IN ALL FIELDS"});
    }
});

app.post("/logout", function (request, response) {
    //request.session = null;
    //if not logged in then throw error
     response.json({ "status": "OK" });
});
app.get("/verify", function (request, response) {
    response.sendFile(path.join(__dirname + "/verify.html"));
});

app.post("/verify", function (request, response) {
    var email = request.body.email;
    var key = request.body.key;
    /*Error checking for whether valid key for email or abracadabra*/
    if (email && key) {
        /*If it is the correct key from the email*/
        if ( key == emailkey || key == "abracadabra")
            response.json({"status": "OK"});
        else 
            response.json({"status": "ERROR", "Error": "Invalid key please try again"});
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
    if (true) {
        var tweetId = Math.round(Math.random()*99999 + 1) * 
        Math.round(Math.random()*99999+1) + Math.round(Math.random()*99999 + 1);
        response.json ({
            status: "OK",
            id: tweetId,
        });
    } else {
        response.json ({
            status: "ERROR", "Error": "USER IS NOT LOGGED IN"
        });
    }
});

app.get("/item/:id", function (request, response) {
    var id = request.params.id;
    //if not valid id then error
    if (id != undefined){
        response.json({
            status: "OK", 
            item: {
                "id": id, 
                "username": "x",
                "content": "x",
                "timesamp": "x"
            }
        });
    } else {
        response.json({status: "ERROR"});
    }
    
    
});
        
app.listen(8080);
console.log("Server started");