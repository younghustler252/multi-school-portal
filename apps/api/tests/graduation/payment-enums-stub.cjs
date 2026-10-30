// TEST-ONLY stand-in. The branch's payments/usecases/handle-webhook.usecase.ts imports "../domain/payment.enums",
// which does not exist, so the app container cannot be loaded. This empty module lets the tests load it.
// Delete this file and the hook in graduation.db.test.ts once the Finance work adds the real file.
module.exports = {};
