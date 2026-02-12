import app from './app.js';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';


const PORT = ENV.PORT || 3000;


// Connect to the database before starting the server
await connectDB();

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});