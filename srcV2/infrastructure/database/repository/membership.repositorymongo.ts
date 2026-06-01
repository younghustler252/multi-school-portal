// src/infrastructure/database/repositories/MembershipRepository.ts

import { IMembershipRepository } from "../../../domain/repositories/membership.repository"
import { Membership } from "../../../domain/entities/membership.entity"
import membershipModel from "../models/membership.model"
import { MembershipMapper } from "../mappers/membership.mappers"
export class MembershipRepository implements IMembershipRepository {

	async save(membership: Membership): Promise<void> {
		const exists = await membershipModel.findById(membership.id).exec()

		if (exists) {
			await membershipModel.findByIdAndUpdate(
				membership.id,
				MembershipMapper.toPersistence(membership)
			).exec()
		} else {
			await membershipModel.create(MembershipMapper.toPersistence(membership))
		}
	}

	async findById(id: string): Promise<Membership | null> {
		const doc = await membershipModel.findById(id).exec()
		if (!doc) return null
		return MembershipMapper.toDomain(doc)
	}

	async findByUserAndSchool(userId: string, schoolId: string): Promise<Membership | null> {
		const doc = await membershipModel.findOne({ user: userId, school: schoolId }).exec()
		if (!doc) return null
		return MembershipMapper.toDomain(doc)
	}

	async findAllBySchool(schoolId: string): Promise<Membership[]> {
		const docs = await membershipModel.find({ school: schoolId }).exec()
		return docs.map(MembershipMapper.toDomain)
	}

	async findAllByUser(userId: string): Promise<Membership[]> {
		const docs = await membershipModel.find({ user: userId }).exec()
		return docs.map(MembershipMapper.toDomain)
	}
}