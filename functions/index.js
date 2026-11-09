const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Scheduler Scheduled Job:
 * Runs automatically every 24 hours at 03:00 AM (Asia/Dhaka timezone).
 * Permanently deletes any delivered order from Firestore whose delivery completion
 * timestamp (deliveredAt) has passed the 10-day retention threshold.
 *
 * NOTE: Requires Firebase Blaze (Pay as you go) plan for Google Cloud Scheduler
 * and Cloud Functions deployment via: `firebase deploy --only functions`
 */
exports.purgeDeliveredOrdersDaily = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('Asia/Dhaka')
  .onRun(async () => {
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    try {
      const snapshot = await db
        .collection('orders')
        .where('orderStatus', '==', 'Delivered')
        .get();

      if (snapshot.empty) {
        console.log('No delivered orders found in database.');
        return null;
      }

      const batch = db.batch();
      let deleteCount = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let deliveryTime = 0;

        if (data.deliveredAt) {
          if (typeof data.deliveredAt.toDate === 'function') {
            deliveryTime = data.deliveredAt.toDate().getTime();
          } else if (data.deliveredAt.seconds) {
            deliveryTime = data.deliveredAt.seconds * 1000;
          } else {
            deliveryTime = new Date(data.deliveredAt).getTime();
          }
        } else if (data.updatedAt) {
          deliveryTime = data.updatedAt.seconds ? data.updatedAt.seconds * 1000 : new Date(data.updatedAt).getTime();
        } else if (data.createdAt) {
          deliveryTime = data.createdAt.seconds ? data.createdAt.seconds * 1000 : new Date(data.createdAt).getTime();
        }

        // Check if 10 days have passed
        if (deliveryTime > 0 && now - deliveryTime >= TEN_DAYS_MS) {
          batch.delete(docSnap.ref);
          deleteCount++;
        }
      });

      if (deleteCount > 0) {
        await batch.commit();
        console.log(`[Cloud Scheduler] Permanently purged ${deleteCount} expired delivered order(s).`);
      } else {
        console.log('[Cloud Scheduler] All delivered orders are currently within 10-day retention.');
      }
    } catch (error) {
      console.error('[Cloud Scheduler] Error during delivered orders auto-purge:', error);
    }

    return null;
  });
