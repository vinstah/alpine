import fs from 'fs'
import { faker } from '@faker-js/faker'
import { createPassword, createUser } from 'tests/db-utils.ts'
import { prisma } from '~/utils/db.server.ts'
import { deleteAllData } from 'tests/setup/utils.ts'
import { getPasswordHash } from '~/utils/auth.server.ts'
import { type User, type Role } from '@prisma/client'

enum TenantUserStatus {
	PENDING_INVITATION,
	PENDING_ACCEPTANCE,
	ACTIVE,
	INACTIVE,
}

export enum TenantUserJoined {
	CREATOR,
	JOINED_BY_INVITATION,
	JOINED_BY_LINK,
	JOINED_BY_PUBLIC_URL,
}

async function createTenant(name: string, workspaces: string[], users: (User & { role: Role })[]) {
	const tenant = await prisma.tenant.create({
		data: {
			name,
		},
	});

	users.forEach(async (user) => {
		await prisma.tenantUser.create({
			data: {
				tenantId: tenant.id,
				userId: user.id,
				roleId: user.role.id,
				joined: TenantUserJoined.CREATOR,
				status: TenantUserStatus.ACTIVE,
			},
		});
	});

	workspaces.forEach(async (name) => {
		const workspace = await prisma.workspace.create({
			data: {
				tenantId: tenant.id,
				name,
				type: 0,
				businessMainActivity: "",
				registrationNumber: "",
			},
		});

		users.forEach(async (user) => {
			await prisma.workspaceUser.create({
				data: {
					workspaceId: workspace.id,
					userId: user.id,
				},
			});
		});
	});

	return tenant;
}

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	console.time('🧹 Cleaned up the database...')
	deleteAllData()
	console.timeEnd('🧹 Cleaned up the database...')

	console.time(`👑 Created admin role/permission...`)
	const adminRole = await prisma.role.create({
		data: {
			name: 'admin',
			permissions: {
				create: { name: 'admin' },
			},
		},
	})
	console.timeEnd(`👑 Created admin role/permission...`)

	console.time(`🛐 Created tenant role/permission...`)
	const tenantRole = await prisma.role.create({
		data: {
			name: 'tenant',
			permissions: {
				create: { name: 'tenant' },
			},
		},
	})
	console.timeEnd(`🛐 Created tenant role/permission...`)

	const totalUsers = 10
	console.time(`👤 Created ${totalUsers} users...`)
	const users = await Promise.all(
		Array.from({ length: totalUsers }, async (_, index) => {
			const userData = createUser()
			const user = await prisma.user.create({
				data: {
					...userData,
					password: {
						create: createPassword(userData.username),
					},
					roles: { connect: { id: tenantRole.id } },
					image: {
						create: {
							contentType: 'image/jpeg',
							file: {
								create: {
									blob: await fs.promises.readFile(
										`./tests/fixtures/images/user/${index % 10}.jpg`,
									),
								},
							},
						},
					},
					notes: {
						create: Array.from({
							length: faker.number.int({ min: 0, max: 10 }),
						}).map(() => ({
							title: faker.lorem.sentence(),
							content: faker.lorem.paragraphs(),
						})),
					},
				},
			})
			return user
		}),
	)
	console.timeEnd(`👤 Created ${totalUsers} users...`)

	console.time(
		`🐨 Created user "kody" with the password "kodylovesyou" and admin role`,
	)
	await prisma.user.create({
		data: {
			email: 'kody@kcd.dev',
			username: 'kody',
			name: 'Kody',
			firstname: 'Kody',
			surname: 'Lovesyou',
			roles: { connect: { id: adminRole.id } },
			image: {
				create: {
					contentType: 'image/png',
					file: {
						create: {
							blob: await fs.promises.readFile(
								'./tests/fixtures/images/user/kody.png',
							),
						},
					},
				},
			},
			password: {
				create: {
					hash: await getPasswordHash('kodylovesyou'),
				},
			},
			notes: {
				create: [
					{
						title: 'Basic Koala Facts',
						content:
							'Koalas are found in the eucalyptus forests of eastern Australia. They have grey fur with a cream-coloured chest, and strong, clawed feet, perfect for living in the branches of trees!',
					},
					{
						title: 'Koalas like to cuddle',
						content:
							'Cuddly critters, koalas measure about 60cm to 85cm long, and weigh about 14kg.',
					},
					{
						title: 'Not bears',
						content:
							"Although you may have heard people call them koala 'bears', these awesome animals aren’t bears at all – they are in fact marsupials. A group of mammals, most marsupials have pouches where their newborns develop.",
					},
				],
			},
		},
	})
	console.timeEnd(
		`🐨 Created user "kody" with the password "kodylovesyou" and admin role`,
	)

	const tenantOwner = await users[1]
	console.log(`👤 Created tenantOwner: ${tenantOwner.username}`)
	const tenantAdmin = await users[0]
	console.log(`👤 Created tenantAdmin: ${tenantAdmin.username}`)
	const tenantMember = await users[2]
	console.log(`👤 Created tenantMember: ${tenantMember.username}`)
	// const user1 = await createUser("John", "Doe", "john.doe@company.com", "password", UserType.Tenant);
	// const user2 = await createUser("Luna", "Davis", "luna.davis@company.com", "password", UserType.Tenant);

	console.time(`🛐 Create TenantOwner Role/Permission...`)

	const tenantOwnerRole = await prisma.role.create({
		data: {
			name: 'tenantOwner',
			permissions: {
				create: { name: 'tenantOwner' },
			},
		},
	})

	console.timeEnd(`🛐 Create TenantOwner Role/Permission...`)

	console.time(`🛐 Create TenantAdmin Role/Permission...`)

	const tenantAdminRole = await prisma.role.create({
		data: {
			name: 'tenantAdmin',
			permissions: {
				create: { name: 'tenantAdmin' },
			},
		},
	})

	console.timeEnd(`🛐 Create TenantAdmin Role/Permission...`)

	console.time(`🛐 Create TenantMember Role/Permission...`)

	const tenantMemberRole = await prisma.role.create({
		data: {
			name: 'tenantMember',
			permissions: {
				create: { name: 'tenantMember' },
			},
		},
	})

	console.timeEnd(`🛐 Create TenantMember Role/Permission...`)

	console.time(`🛐 Create TenantGuest Role/Permission...`)

	const tenantGuestRole = await prisma.role.create({
		data: {
			name: 'tenantGuest',
			permissions: {
				create: { name: 'tenantGuest' },
			},
		},
	})

	console.timeEnd(`🛐 Create TenantGuest Role/Permission...`)

	console.time(`📇 Create Tenant 1 & workspace T1.Workspace 1, T1.Workspace 2`)
	await createTenant(
		"Tenant 1",
		["T1.Workspace 1", "T1.Workspace 2"],
		[
			{ ...tenantOwner, role: tenantOwnerRole },
			{ ...tenantAdmin, role: tenantAdminRole },
			{ ...tenantMember, role: tenantMemberRole },
		]
	);
	console.timeEnd(`📇 Create Tenant 1 & workspace T1.Workspace 1, T1.Workspace 2`)

	console.time(`📇 Create Tenant 2 & workspace T2.Workspace 1, T2.Workspace 2`)
	await createTenant(
		"Tenant 2",
		["T2.Workspace 1", "T2.Workspace 2"],
		[
			{ ...tenantAdmin, role: tenantOwnerRole },
			{ ...tenantMember, role: tenantMemberRole },
		]
	);

	console.timeEnd(`📇 Create Tenant 2 & workspace T2.Workspace 1, T2.Workspace 2`)
	console.timeEnd(`🌱 Database has been seeded`)
}

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})

/*
eslint
	@typescript-eslint/no-unused-vars: "off",
*/
