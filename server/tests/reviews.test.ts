import { beforeEach, describe, expect, it } from 'vitest';
import { api, createUser, resetDb, setupCompletedRental, setupPendingRental } from './helpers.js';

const renterReview = (rentalRequestId: string) => ({ rentalRequestId, overall: 5, comment: 'Výborné', punctuality: 5, communication: 4, reliability: 5 });
const ownerReview = (rentalRequestId: string) => ({ rentalRequestId, overall: 4, comment: 'Dobré', communication: 4, respectfulUse: 5, onTimeReturn: 4 });

describe('reviews', () => {
  beforeEach(resetDb);

  it('prevents reviews before completion', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    const res = await api().post('/api/reviews/user').set(renter.auth).send(renterReview(rentalId)).expect(409);
    expect(res.body.error.message).toBe('Hodnotiť je možné až po dokončení prenájmu.');
  });

  it('allows both directions once and prevents duplicates', async () => {
    const { owner, renter, rentalId } = await setupCompletedRental();
    await api().post('/api/reviews/user').set(renter.auth).send(renterReview(rentalId)).expect(201);
    await api().post('/api/reviews/user').set(owner.auth).send(ownerReview(rentalId)).expect(201);
    const dup = await api().post('/api/reviews/user').set(renter.auth).send(renterReview(rentalId)).expect(409);
    expect(dup.body.error.message).toBe('Tento prenájom si už ohodnotil.');

    const ownerReviews = await api().get(`/api/users/${owner.user.id}/reviews`).expect(200);
    expect(ownerReviews.body.summary.count).toBe(1);
    expect(ownerReviews.body.summary.average).toBe(5);
    expect(ownerReviews.body.summary.distribution['5']).toBe(1);
  });

  it('renter rates the item once; owner cannot rate own item', async () => {
    const { owner, renter, rentalId, item } = await setupCompletedRental();
    const body = { rentalRequestId: rentalId, descriptionAccuracy: 5, itemCondition: 4, valueForMoney: 5, handoverExperience: 5, overall: 5 };
    await api().post('/api/reviews/item').set(owner.auth).send(body).expect(403);
    await api().post('/api/reviews/item').set(renter.auth).send(body).expect(201);
    await api().post('/api/reviews/item').set(renter.auth).send(body).expect(409);
    const list = await api().get(`/api/items/${item.id}/reviews`).expect(200);
    expect(list.body.summary.count).toBe(1);
  });

  it('prevents reviewing a rental the user was not part of and validates rating range', async () => {
    const { rentalId, renter } = await setupCompletedRental();
    const outsider = await createUser();
    await api().post('/api/reviews/user').set(outsider.auth).send(renterReview(rentalId)).expect(403);
    await api().post('/api/reviews/user').set(renter.auth).send({ ...renterReview(rentalId), overall: 6 }).expect(400);
  });
});
