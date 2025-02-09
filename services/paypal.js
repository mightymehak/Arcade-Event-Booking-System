const axios = require('axios');
const qs = require('querystring'); // Import querystring module to URL encode the body.
require('dotenv').config();


// Function to generate PayPal access token
async function generateAccessToken() {
    try {
        const response = await axios({
            url: process.env.PAYPAL_BASE_URL + '/v1/oauth2/token',
            method: 'post',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded', // Set the content type to x-www-form-urlencoded
            },
            data: qs.stringify({ grant_type: 'client_credentials' }), // URL-encode the body
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET,
            },
        });
        console.log(response.data.access_Token);
        return response.data.access_token;
    } catch (error) {
        console.error('Error generating access token:', error.response ? error.response.data : error.message);
        throw new Error('Unable to generate PayPal access token');
    }
}

generateAccessToken()

// Event details
const eventDetails = [
    {
        name: 'Retro Night',
        description: 'Fun-filled night back to the 90s era',
        price: 1000, // Price in INR
        quantity: 1,
    },
    {
        name: 'Esportsmania',
        description: 'Enter into the arena of games',
        price: 1500, // Price in INR
        quantity: 1,
    },
    {
        name: 'Karaoke Night',
        description: 'Sing your heart out',
        price: 1100, // Price in INR
        quantity: 1,
    },
    {
        name: 'Family Fun Day',
        description: 'Spend Quality Time with your family',
        price: 1000, // Price in INR
        quantity: 3,
    },
];

// Function to create an individual PayPal order for an event
exports.createOrder = async (event) => {
    try {
        const accessToken = await generateAccessToken();

        // Convert INR to USD for PayPal sandbox (1 INR = 0.012 USD, approximate conversion rate)
        const usdPrice = (event.price * 0.012).toFixed(2); // Convert to USD and round to 2 decimal places
        const totalAmount = (usdPrice * event.quantity).toFixed(2);

        const response = await axios({
            url: process.env.PAYPAL_BASE_URL + '/v2/checkout/orders',
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + accessToken,
            },
            data: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        items: [
                            {
                                name: event.name,
                                description: event.description,
                                quantity: event.quantity.toString(),
                                unit_amount: {
                                    currency_code: 'USD', // Use USD for PayPal sandbox
                                    value: usdPrice.toString(),
                                },
                            },
                        ],
                        amount: {
                            currency_code: 'USD', // Use USD for PayPal sandbox
                            value: totalAmount.toString(),
                            breakdown: {
                                item_total: {
                                    currency_code: 'USD',
                                    value: totalAmount.toString(),
                                },
                            },
                        },
                    },
                ],
                application_context: {
                    return_url: process.env.BASE_URL + '/complete-order',
                    cancel_url: process.env.BASE_URL + '/cancel-order',
                    shipping_preference: 'NO_SHIPPING',
                    user_action: 'PAY_NOW',
                    brand_name: 'Tickets'
                }
            }),
        });

        return response.data;
    } catch (error) {
        console.error('Error creating order:', error.response ? error.response.data : error.message);
        throw error;
    }
};


exports.capturePayment = async (orderId) => {
    try {
        const accessToken = await generateAccessToken();

        const response = await axios({
            url: process.env.PAYPAL_BASE_URL + `/v2/checkout/orders/${orderId}/capture`,
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + accessToken,
            },
            timeout: 10000, 
        });

        return response.data;
    } catch (error) {
        console.error('Error capturing payment:', error.response ? error.response.data : error.message);
        throw error;
    }
}