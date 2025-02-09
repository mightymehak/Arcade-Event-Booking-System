const express = require('express');
const mysql = require('mysql');
const app = express();
const dotenv = require('dotenv');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken'); 
const bcrpyt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const paypal = require('./services/paypal');
const qrcode = require('qrcode');
const cors = require("cors");

dotenv.config({ path: './.env' });


const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE,
});

db.connect((err) => {
    if (err) {
        console.log(err);
        return;
    }
    console.log('Connected to database');
});

app.use(express.static(path.join(__dirname, './public')));
app.use(cookieParser());
app.use(cors({ origin: "http://localhost:5500", credentials: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/api/user", (req, res) => {
    const userId = req.cookies.id; // Retrieve user ID from cookie
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    db.query("SELECT name, email, phone, normal_password FROM users WHERE id = ?", [userId], (err, result) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (result.length > 0) {
            res.json(result[0]);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));  
});


app.post('/auth/signup', (req, res) => {
    const { name, email, phone, password } = req.body;

    
    if (!name || !email || !phone || !password) {
        return res.status(400).send('All fields are required');
    }

    // Check if the email, name, or phone already exist in the database
    db.query('SELECT email, name, phone FROM users WHERE email = ? OR name = ? OR phone = ?', [email, name, phone], async(error, result) => {
        if (error) {
            console.log(error);
            return res.status(500).send('Internal Server Error');
        }

        // If there are results, it means the user already exists
        if (result.length > 0) {
            let message = '';
            if (result.some(user => user.email === email)) {
                message = 'That email is already in use';
            }
            if (result.some(user => user.name === name)) {
                message = message ? message + ' and that username is already in use' : 'That username is already in use';
            }
            if (result.some(user => user.phone === phone)) {
                message = message ? message + ' and that phone number is already in use' : 'That phone number is already in use';
            }

            // Redirect back to the signup page with the error message as a query parameter
            return res.redirect(`/signup?message=${encodeURIComponent(message)}`);
        }

        //Hash the password
        let hashedPassword = await bcrpyt.hash(password, 8);
        console.log(hashedPassword);

        // If no existing user, insert the new user into the database
        const query = 'INSERT INTO users (name, email, phone, password,normal_password) VALUES (?, ?, ?, ?,?)';
        db.query(query, [name, email, phone, hashedPassword,password], (err, result) => {
            if (err) {
                console.error('Error inserting user into database:', err);
                return res.status(500).send('Internal Server Error');
            }

            const user = result.insertId;
            console.log('New User Inserted with ID:', user);
            res.cookie('id', user.id, { maxAge: 3600000, sameSite: 'Strict' });

            db.query('SELECT id, name, email, phone , normal_password FROM users WHERE id = ?', [user], (err, userResult) => {
                if (err) {
                    console.error('Error fetching user from database:', err);
                    return res.status(500).send('Internal Server Error');
                }

                console.log('User Details:', userResult);

                // User found, set the cookie and redirect to the dashboard
                if (userResult.length > 0) {
                    const user = userResult[0]; // Get user details from the result
                    res.cookie('id', user.id, { maxAge: 3600000, sameSite: 'Strict' });
                    res.cookie('name', user.name, { maxAge: 3600000, sameSite: 'Strict' });
                    res.cookie('email', user.email, { maxAge: 3600000, sameSite: 'Strict' });
                    res.cookie('phone', user.phone, { maxAge: 3600000, sameSite: 'Strict' });
                    res.cookie('normal_password', user.password, { maxAge: 3600000, sameSite: 'Strict' });
                    // Redirect to the user dashboard or home page
                    return res.redirect('/newindex.html');
                } else {
                    console.log('User not found after insertion');
                    return res.status(404).send('User not found');
                }
            });
        });


    });
});

app.post('/auth/login',(req,res)=>{
    const{email,password} = req.body;

    if(!email || !password){
        return res.status(400).send('All fields are required');
    }

    db.query('SELECT * FROM users WHERE email = ?',[email],async(error,result)=>{
        if(error){
            console.log(error);
            return res.status(500).send('Internal Server Error');
        }

        if(result.length === 0){
            let message = 'Invalid email or password';
            return res.redirect(`/login?message=${encodeURIComponent(message)}`);
        }

        const user = result[0];
        const match = await bcrpyt.compare(password,user.password);

        if(!match){
            let message = 'Incorrect password';
            return res.redirect(`/login?message=${encodeURIComponent(message)}`);
        }

        const token = jwt.sign(
            {id: user.id,
            email: user.email,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '1h',
            }
        )

        res.cookie('token', token, {
            httpOnly: true,  
            secure: process.env.NODE_ENV === 'production',  
            maxAge: 3600000,  
            sameSite: 'Strict',  
        });

        res.cookie('id', user.id, { maxAge: 3600000, sameSite: 'Strict' });

        res.redirect(`/newindex.html?message=${encodeURIComponent('Logged in successfully')}`);
    })
});

//Middleware to verify the token
const verifyToken = (req, res, next) => {
    const token = req.cookies.token;  // Retrieve the token from cookies

    if (!token) {
        return res.redirect('/login?message=' + encodeURIComponent('Please login first.'));
    }

    // Verify the token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.redirect('/login?message=' + encodeURIComponent('Invalid or expired token.'));
        }

        req.user = user;  // Attach user info to request object
        next();  // Proceed to the next middleware or route handler
    });
};

app.post('/pay', async (req, res) => {
    const { eventName, eventPrice, eventQuantity } = req.body;

    if(isNaN(eventPrice) || isNaN(eventQuantity)){
        return res.status(400).send('Invalid price or quantity');
    }

    try {
        // Create an event object from form data
        const event = {
            name: eventName,
            description: 'Event description', // Add a description if needed
            price : parseFloat(eventPrice).toFixed(2), // Convert to number
            quantity: parseInt(eventQuantity, 10) // Convert to integer
        };

        // Create PayPal order
        const orderResponse = await paypal.createOrder(event);

        // Extract the order ID from the PayPal response
        const orderId = orderResponse.id;

        // Save the order ID and event name in the MySQL database
        const query = 'INSERT INTO orders (order_id, event_name) VALUES (?, ?)';
        await db.query(query, [orderId, event.name]);

        console.log('Order saved to database:', { orderId, eventName: event.name });

        // Redirect the user to the PayPal approval URL
        const approveUrl = orderResponse.links.find(link => link.rel === 'approve').href;
        console.log(`Order created for ${event.name}:`, orderResponse);
        res.redirect(`${approveUrl}`);
    } catch (error) {
        if (error.response) {
            console.log('PayPal API error:', error.response.data);
            console.log('Status code:', error.response.status);
            console.log('Headers:', error.response.headers);
        } else {
            console.log('Error:', error.message);
        }
        throw new Error('Unable to create PayPal order');
    }
});

function generateqrcode(text) {
    const ORDERID = String(text); 
    
    return new Promise((resolve, reject) => {
        qrcode.toFile(path.join(__dirname, 'public', 'qrcode.png'), ORDERID, {
            color: {
                dark: '#000000',  // QR code color
                light: '#ffffff'  // Background color
            }
        }, (err) => {
            if (err) {
                reject('Error generating QR code:', err);
            } else {
                resolve('QR Code generated successfully!');
            }
        });
    });
}




app.get('/complete-order',async(req,res)=>{
    try{
        await paypal.capturePayment(req.query.token);

        const orderId = req.query.token;
        await generateqrcode(orderId);

        res.redirect(`/payment_successful.html?orderId=${orderId}`);
    }catch(error){
        console.error('Error completing order:',error);
        return res.status(500).send('Internal Server Error');
    }
});

app.get('/cancel-order',(req,res)=>{
    res.sendFile(path.join(__dirname,'public','tickets.html'));
});


app.get('/newindex.html', verifyToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'newindex.html'));
});

app.get('/newindex.html', (req, res) => {

    res.sendFile(path.join(__dirname, 'public', 'newindex.html'));
}); 

app.get('/signup', (req, res) => {
    // Check if there is a message in the query string
    const message = req.query.message || ''; // If no message, default to empty string

    // Send the signup page with the message (this will be displayed on the page)
    res.sendFile(path.join(__dirname, 'public', 'signup.html'), { message: message });
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));  
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
