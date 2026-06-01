// src/domain/repositories/membership.repository.ts

import { Membership } from "../entities/membership.entity"

export interface IMembershipRepository {
	save(membership: Membership): Promise<void>
	findById(id: string): Promise<Membership | null>
	findByUserAndSchool(userId: string, schoolId: string): Promise<Membership | null>
	findAllBySchool(schoolId: string): Promise<Membership[]>
	findAllByUser(userId: string): Promise<Membership[]>
}