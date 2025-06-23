
//scheduling node-cron job to automatically delete unused files after a timestamp.

import cron from 'node-cron'
import Transfer from '../models/Transfer'


const initCleanupService = () => {
    cron.schedule('0 * * * *', async () => {
        console.log('Running scheduled cleanup job for transfers...');
        const now = new Date();

        const twoHoursAgo = new Date(now.getTime() - (2*60*60*1000)) //2 hrs in milliseconds

        try {
            
            const result = await Transfer.deleteMany({
                $or: [
                    {status: 'pending', createdAt: {$lt: twoHoursAgo}},
                    {status: 'completed', createdAt: {$lt: twoHoursAgo}}
                ]
            });

            console.log(`Cleanup Job finished. Deleted ${result.deletedCount} old transfers`);
            
        } catch (error: any) {
            console.error(`Error during cleanup job: ${error.message}`);
            
        }
    });

    console.log('Cleanup service initialized. Scheduled to run hourly');

}

export default initCleanupService;