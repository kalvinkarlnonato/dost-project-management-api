const UserVerification = require("../models/user.verification.model");
const User = require("../models/user.model");
const Workload = require("../models/user.workload");
const config = require("../../config.json");
const jwt = require('jsonwebtoken');
const Bcrypt = require("bcryptjs");
const secret = "kalvin-karl-secret-key";
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
// Create transporter to nodemailer
const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: config.email.AUTH_EMAIL,
		pass: config.email.AUTH_PASS
	}
});
// Verify the transporter
transporter.verify((error,success) => {
	if(error){
		console.log(error);
	}else{
		console.log("Nodemailer email status:"+success);
	}
});
// Send verification
const sendVerification = (user,res) => {
	//url to be used in email
	const currentUrl = config.URL;
	const uniqueString = uuidv4();
	const mailOptions = {
		from: config.email.AUTH_EMAIL,
		to: user.email,
		subject: "Verify your Email",
		html: `<p>Verify your email address to complete the signup and login into your account.</p><p>This link <b>expires in 6 hours</b>.</p><p>Press <a href=${currentUrl+"/users/verify/"+user.id+"/"+uniqueString}>here</a> to proceed.</p>`
	}
	let userVerification = new UserVerification({
		userId: user.id,
		uniqueString: Bcrypt.hashSync(uniqueString, 12),
		createdAt: new Date(Date.now()),
		expiresAt: new Date(Date.now()+21600000)
	})
	UserVerification.create(userVerification, (error,result) => {
		if(!error){
			// email verification send
			transporter.sendMail(mailOptions,(err,info)=>{
				if(!err){
					res.send({ message: "Verification email sent." , result, info });
					console.log({ message: "Verification email sent." , result, info });
				} else {
					res.status(500).send({ message: "Some error occurred while sending email." , err });
					console.log({ message: "Some error occurred while sending email." , err });
				}
			})
		} else {
			res.status(500).send({ message: "Some error occurred saving verification.", error });
			console.log({ message: "Some error occurred saving verification.", error });
		}
	})
}
// Check if signin uses username or email
const checkUsernameEmail = (user, result) => {
	if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(user)) {
			// Login using email address
			User.findByEmail(user, (err, res) => {
				result(err, res);
			});
    }else if(typeof(user)=="number") {
			// Login using contact
			User.findByContact(user, (err, res) => {
				result(err, res);
			});
		}
		else {
			// Login using username
			User.findByUsername(user, (err, res) => {
				result(err, res);
			});
	}
}
// User login
exports.signin = (req, res, next) => {
	// Validate Request
	if (!req.body) {
		res.status(400);
		next();
	}
	checkUsernameEmail(req.body.user, (error,user) => {
		if(error === 'NOT_FOUND'){
			res.status(404);
		}else if(error){
			res.status(500);
		}else{
			let passwordIsEqual = Bcrypt.compareSync(req.body.password, user.password);
			if(passwordIsEqual){
				req.user = user;
				if(!user.verified){
					res.status(403);
				}else{
					res.status(200);
				}
			}else{
				res.status(401);
			}
		}
		next();
	});
}
// User success login for rate limit middleman
exports.login = (req,res) => {
	if(res.statusCode === 400){
		res.send({ message: "Content can not be empty!" });
		console.log({ message: "Content can not be empty!" });
	}else if(res.statusCode === 500){
		res.send({ message: "Error retrieving User"});
		console.log({ message: "Error retrieving User"});
	}else if(res.statusCode === 403){
		res.send({message: "Email hasn't been verified yet.", email: req.user.email});
		console.log({message: "Email hasn't been verified yet.", email: req.user.email});
	}else if(res.statusCode === 404){
		res.send({ message: "User not found" });
		console.log({ message: "User not found" });
	}else if(res.statusCode === 401){
		res.send({ message: "Incorrect password!" });
		console.log({ message: "Incorrect password!" });
	}else{
		let token = jwt.sign({
			id: req.user.id
		},secret,{expiresIn: 86400});
		res.send({ 
			id:req.user.id,
			username: req.user.username,
			email: req.user.email,
			role: req.user.role,
			token: token
		});
		console.log({ message: "User loged in the system" });
	}
}
// User signup
exports.signup = (req, res, next) => {
	// Validate request
	if (!req.body) {
			res.status(400).send({
					message: "Content can not be empty!"
			});
			console.log({message: "Content is empty!"});
	}
	// Checking if user already exists
	User.findByUsername(req.body.username, async (usernameError,udata) => {
		User.findByEmail(req.body.email, (mailError,edata) => {
			if((!mailError && !usernameError) && (udata.id === edata.id)){
				res.status(409).send({
					title: "Exist",
					message: "User is already exist, please login using your username " + req.body.username
				});
				console.log({message: "User is already exist, please login using your username "});
			} else if(!usernameError) {
				res.status(409).send({
					title: "Username",
					message: "A user is already exist using your username " + req.body.username
				});
				console.log({message: "A user is already exist using your username "});
			} else if(!mailError) {
				res.status(409).send({
					title: "Email",
					message: "A user is already exist using your email address " + req.body.email
				});
				console.log({message: "A user is already exist using your email address "});
			}else{
				if (usernameError === "NOT_FOUND" && mailError === "NOT_FOUND") {
					next();
				} else {
					res.status(500).send({ message: "Error checking for existing user in database", mailError });
					console.log({ message: "Error checking for existing user in database", mailError });
				}
			}
		})
	})
}
// User success register for rate limit middleman
exports.register = (req,res) => {
	// Create a User
	let user = new User({
		username: req.body.username,
		email: req.body.email,
		contact: req.body.contact,
		password: Bcrypt.hashSync(req.body.password, 12),
		role: 'u',
	});
	User.create(user, (error, result) => {
		if (!error){
			sendVerification(result,res);
		} else {
			res.status(500).send({ message: "Some error occurred while creating the User.", error });
			console.log({ message: "Some error occurred while creating the User.", error });
		}
	});
}
// Resend verification if verify is less than 3
exports.resendVerification = (req, res) =>{
	User.findByEmail(req.body.unverifiedEmail, (error, result)=>{
		if(!error){
			if(!result.verified){
				UserVerification.findById(result.id, (errr,ress)=>{
					if(!errr){
						if(ress.length < 3){
							sendVerification(result,res);
						}else{
							if(ress[0].expiresAt < Date.now()){
								UserVerification.deleteById(result.id,(err) => {
									if(!err){
										sendVerification(result,res);
									}else{
										res.status(500).send({ message: "An error occured while deleting verification" });
										console.log({ message: "An error occured while deleting verification" });
									}
								})
							} else {
								res.status(406).send({ message: "Too many email verification found. Please wait for the 6 hours and try come again." });
								console.log({ message: "Too many email verification found. Please wait for the 6 hours and try come again." });
							}
						}
					}else if(errr === "NOT_FOUND"){
						sendVerification(result,res);
					}else{
						res.status(500).send({ message: "An error occured while looking for verification" });
						console.log({ message: "An error occured while looking for verification" });
					}
				})
			}else{
				res.status(409).send({message: "Your account is already validated. This error is not normal, We will inform the server for this report. thank you for understanding"});
				console.log({message: "Your account is already validated. This error is not normal, We will inform the server for this report. thank you for understanding"});
			}
		}else if (error === "NOT_FOUND"){
			res.status(404).send({ message: "Failed! user email not found" });
			console.log({ message: "Failed! user email not found" });
		}else{
			res.status(500).send({ message: "An error occured during the search of user email" });
			console.log({ message: "An error occured during the search of user email" });
		}
	})
}
// Verify email confimation
exports.verify = (req,res) => {
	let userId = req.params.id.trim();
	let uniqueString = req.params.uniqueString.trim();
	UserVerification.findById(userId, (error,result)=>{
		if(!error){
			if(result[0].expiresAt < Date.now()){
				UserVerification.deleteById(userId,(err)=>{
					if(!err){
						User.deleteById(userId,(er)=>{
							if(!er){
								res.status(401).send({ message: "Verification code expired. Please sign up again" });
								console.log({ message: "Verification code expired. Please sign up again" });
							}else if(er === "NOT_FOUND"){
								res.status(404).send({ message: "User not found" });
								console.log({ message: "User not found" });
							}else{
								res.status(500).send({ message:"Some error occured while deleting expired user by verification" });
								console.log({ message:"Some error occured while deleting expired user by verification" });
							}
						})
					}else if(err === "NOT_FOUND"){
						res.status(404).send({ message: "Verification not found" });
						console.log({ message: "Verification not found" });
					}else{
						res.status(500).send({ message:"Some error occured while deleting verification",err });
						console.log({ message:"Some error occured while deleting verification",err });
					}
				})
			}else{
				equalString = Bcrypt.compareSync(uniqueString,result[0].uniqueString);
				if(equalString){
					User.updateVerified(userId, true, (err) => {
						if(!err){
							UserVerification.deleteById(userId,(er)=>{
								if(!err){
									res.send({ message: "Successfully verified!" });
									console.log({ message: "Successfully verified!" });
								}else if(er === "NOT_FOUND"){
									res.status(404).send({ message: "Removing verification not found" });
									console.log({ message: "Removing verification not found" });
								}else{
									res.status(500).send({ message:"Some error occured while removing verification",err });
									console.log({ message:"Some error occured while removing verification",err });
								}
							})
						}else if(err === "NOT_FOUND"){
							res.status(404).send({ message: "Update a user not found" });
							console.log({ message: "Update a user not found" });
						}else{
							res.status(500).send({ message:"Some error occured while updating user",err });
							console.log({ message:"Some error occured while updating user",err });
						}
					})
				}else{
					res.status(401).send({ message: "Invalid verification details passed. Please check your inbox"});
					console.log({ message: "Invalid verification details passed. Please check your inbox"});
				}
			}
		} else {
			if(error === "NOT_FOUND"){
				res.status(404).send({ message: "User verification not found" });
				console.log({ message: "User verification not found" });
			}else{
				res.status(500).send({ message:"Some error occured while finding user" });
				console.log({ message:"Some error occured while finding user" });
			}
		}
	})
}
// Find a single user by Username
exports.findByUsername = (req, res) => {
	let username = req.params.username.trim();
	User.findByUsername(username, (error, result) => {
		if (!error) {
			res.send(result);
			console.log({message: "User found",...result});
		} else {
			if (error === "NOT_FOUND") {
				res.status(404).send({ message: "A user not found with username of " + username });
				console.log({ message: "A user not found with username of " + username });
			} else {
				res.status(500).send({ message: "Error retrieving a user in database", error });
				console.log({ message: "Error retrieving a user in database", error });
			}
		}
	})
}
// Find a single user by email
exports.findByEmail = (req, res) => {
	let email = req.params.email.trim();
	User.findByEmail(email, (error, result) => {
		if (!error) {
			res.send(result);
			console.log({message: "User found",...result});
		} else {
			if (error === "NOT_FOUND") {
				res.status(404).send({ message: "A user not found with email of " + email });
				console.log({ message: "A user not found with email of " + email });
			} else {
				res.status(500).send({ message: "Error retrieving a user in database", error });
				console.log({ message: "Error retrieving a user in database", error });
			}
		}
	})
}

// THIS IS FOR MDB READER FILE
// // Get the adodb module
// var ADODB = require('node-adodb');
// ADODB.debug = true;

// // Connect to the MS Access DB
// var connection = ADODB.open('Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\\dbs\\database.accdb;Persist Security Info=False;');

const ADODB = require('node-adodb');
const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\dbs\\dbWorkload.mdb;');
exports.mdbr = async (req,res) => {
	try {
		const data = await connection.query("SELECT * FROM tblWorkLoad");
		let workload = new Workload(data[0]);
		console.log(workload);
		Workload.createWorkload(workload, (error, result) => {
			if(!error){
				res.send({ message: "New workload successfully created", added: workload});
			}else{
				res.status(500).send({ message: "Some error occurred while creating the User.", error });
			}
		}); 
		res.send({message:"ok"});

	} catch (error) {
		console.error(error);
	}
}