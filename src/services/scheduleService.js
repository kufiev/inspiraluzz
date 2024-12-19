const { postDraftToYouTube } = require('./postYoutube');

const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();
const moment = require('moment');

async function checkScheduledDrafts() {
  const now = moment().toISOString();

  try {
    const draftsSnapshot = await db.collectionGroup('items').limit(500).get();

    if (draftsSnapshot.empty) {
      console.log('No drafts to process.');
      return;
    }

    console.log(`${draftsSnapshot.size} drafts found for processing.`);

    let count = 0;

    for (const doc of draftsSnapshot.docs) {
      const draft = doc.data();
      console.log(`Processing draft: ${draft.id || doc.id}`);

      if (
        draft.status === 'draft' &&
        draft.scheduledTime &&
        moment(draft.scheduledTime).isBefore(now)
      ) {
        const draftRef = doc.ref;

        try {
          await draftRef.update({
            status: 'pending',
          });

          await postDraftToYouTube(draft.userUid, draft.draftId);

          // Update the draft status to 'published'
          await draftRef.update({
            status: 'published',
            processedAt: now,
          });
          console.log(
            `Draft ${draft.id || doc.id} status updated to 'published'.`
          );
        } catch (error) {
          console.error(`Failed to process draft ${draft.id || doc.id}`, error);
          // Revert status to 'scheduled' if processing fails
          try {
            await draftRef.update({ status: 'draft' });
          } catch (rollbackError) {
            console.error(
              `Failed to rollback status for draft ${draft.id || doc.id}:`,
              rollbackError
            );
          }
          continue;
        }

        // Delete the draft after processing
        try {
          await draftRef.delete();
          console.log(`Draft ${draft.id || doc.id} deleted successfully.`);
          count++;
        } catch (error) {
          console.error(`Failed to delete draft ${draft.id || doc.id}:`, error);
        }
      } else {
        console.log(`Draft ${draft.id || doc.id} is not scheduled yet.`);
      }
    }

    if (count > 0) {
      console.log(`Successfully processed and deleted ${count} drafts.`);
    } else {
      console.log('No drafts to update or delete.');
    }
  } catch (error) {
    console.error('Error processing drafts:', error);
  }
}

module.exports = { checkScheduledDrafts };
