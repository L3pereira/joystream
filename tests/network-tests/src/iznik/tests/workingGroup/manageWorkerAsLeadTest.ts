import { initConfig } from '../../utils/config'
import { registerJoystreamTypes } from '@alexandria/types'
import { closeApi } from '../../utils/closeApi'
import { ApiWrapper, WorkingGroups } from '../../utils/apiWrapper'
import { WsProvider, Keyring } from '@polkadot/api'
import { KeyringPair } from '@polkadot/keyring/types'
import { setTestTimeout } from '../../utils/setTestTimeout'
import {
  AddLeaderOpeningFixture,
  ApplyForOpeningFixture,
  BeginLeaderApplicationReviewFixture,
  FillLeaderOpeningFixture,
  AddWorkerOpeningFixture,
  WithdrawApplicationFixture,
  BeginApplicationReviewFixture,
  FillOpeningFixture,
  LeaveRoleFixture,
  DecreaseStakeFixture,
  SlashFixture,
  TerminateRoleFixture,
} from '../fixtures/workingGroupModule'
import { BuyMembershipHappyCaseFixture } from '../fixtures/membershipModule'
import { Utils } from '../../utils/utils'
import BN from 'bn.js'
import tap from 'tap'

tap.mocha.describe('Manage worker as worker scenario', async () => {
  initConfig()
  registerJoystreamTypes()

  const nodeUrl: string = process.env.NODE_URL!
  const sudoUri: string = process.env.SUDO_ACCOUNT_URI!
  const keyring = new Keyring({ type: 'sr25519' })
  const provider = new WsProvider(nodeUrl)
  const apiWrapper: ApiWrapper = await ApiWrapper.create(provider)
  const sudo: KeyringPair = keyring.addFromUri(sudoUri)

  const N: number = +process.env.WORKING_GROUP_N!
  const nKeyPairs: KeyringPair[] = Utils.createKeyPairs(keyring, N)
  const leadKeyPair: KeyringPair[] = Utils.createKeyPairs(keyring, 1)

  const paidTerms: number = +process.env.MEMBERSHIP_PAID_TERMS!
  const applicationStake: BN = new BN(process.env.WORKING_GROUP_APPLICATION_STAKE!)
  const roleStake: BN = new BN(process.env.WORKING_GROUP_ROLE_STAKE!)
  const firstRewardInterval: BN = new BN(process.env.LONG_REWARD_INTERVAL!)
  const rewardInterval: BN = new BN(process.env.LONG_REWARD_INTERVAL!)
  const payoutAmount: BN = new BN(process.env.PAYOUT_AMOUNT!)
  const unstakingPeriod: BN = new BN(process.env.STORAGE_WORKING_GROUP_UNSTAKING_PERIOD!)
  const durationInBlocks = 60
  const openingActivationDelay: BN = new BN(0)

  setTestTimeout(apiWrapper, durationInBlocks)

  const happyCaseFixture: BuyMembershipHappyCaseFixture = new BuyMembershipHappyCaseFixture(
    apiWrapper,
    sudo,
    nKeyPairs,
    paidTerms
  )
  tap.test('Creating a set of members', async () => happyCaseFixture.runner(false))

  const leaderHappyCaseFixture: BuyMembershipHappyCaseFixture = new BuyMembershipHappyCaseFixture(
    apiWrapper,
    sudo,
    leadKeyPair,
    paidTerms
  )
  tap.test('Buying membership for leader account', async () => leaderHappyCaseFixture.runner(false))

  const addLeaderOpeningFixture: AddLeaderOpeningFixture = new AddLeaderOpeningFixture(
    apiWrapper,
    nKeyPairs,
    sudo,
    applicationStake,
    roleStake,
    openingActivationDelay,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Add lead opening', async () => await addLeaderOpeningFixture.runner(false))

  let applyForLeaderOpeningFixture: ApplyForOpeningFixture
  tap.test('Apply for lead opening', async () => {
    applyForLeaderOpeningFixture = new ApplyForOpeningFixture(
      apiWrapper,
      leadKeyPair,
      sudo,
      applicationStake,
      roleStake,
      addLeaderOpeningFixture.getResult()!,
      WorkingGroups.StorageWorkingGroup
    )
    await applyForLeaderOpeningFixture.runner(false)
  })

  let beginLeaderApplicationReviewFixture: BeginLeaderApplicationReviewFixture
  tap.test('Begin lead application review', async () => {
    beginLeaderApplicationReviewFixture = new BeginLeaderApplicationReviewFixture(
      apiWrapper,
      sudo,
      addLeaderOpeningFixture.getResult()!,
      WorkingGroups.StorageWorkingGroup
    )
    await beginLeaderApplicationReviewFixture.runner(false)
  })

  let fillLeaderOpeningFixture: FillLeaderOpeningFixture
  tap.test('Fill lead opening', async () => {
    fillLeaderOpeningFixture = new FillLeaderOpeningFixture(
      apiWrapper,
      leadKeyPair,
      sudo,
      addLeaderOpeningFixture.getResult()!,
      firstRewardInterval,
      rewardInterval,
      payoutAmount,
      WorkingGroups.StorageWorkingGroup
    )
    await fillLeaderOpeningFixture.runner(false)
  })

  const addWorkerOpeningFixture: AddWorkerOpeningFixture = new AddWorkerOpeningFixture(
    apiWrapper,
    nKeyPairs,
    leadKeyPair[0],
    sudo,
    applicationStake,
    roleStake,
    openingActivationDelay,
    unstakingPeriod,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Add worker opening', async () => addWorkerOpeningFixture.runner(false))

  let applyForWorkerOpeningFixture: ApplyForOpeningFixture
  tap.test('First apply for worker opening', async () => {
    applyForWorkerOpeningFixture = new ApplyForOpeningFixture(
      apiWrapper,
      nKeyPairs,
      sudo,
      applicationStake,
      roleStake,
      addWorkerOpeningFixture.getResult()!,
      WorkingGroups.StorageWorkingGroup
    )
    await applyForWorkerOpeningFixture.runner(false)
  })

  let beginApplicationReviewFixture: BeginApplicationReviewFixture
  tap.test('Begin application review', async () => {
    beginApplicationReviewFixture = new BeginApplicationReviewFixture(
      apiWrapper,
      leadKeyPair[0],
      sudo,
      addWorkerOpeningFixture.getResult()!,
      WorkingGroups.StorageWorkingGroup
    )
    await beginApplicationReviewFixture.runner(false)
  })

  let fillOpeningFixture: FillOpeningFixture
  tap.test('Fill worker opening', async () => {
    fillOpeningFixture = new FillOpeningFixture(
      apiWrapper,
      nKeyPairs,
      leadKeyPair[0],
      sudo,
      addWorkerOpeningFixture.getResult()!,
      firstRewardInterval,
      rewardInterval,
      payoutAmount,
      WorkingGroups.StorageWorkingGroup
    )
    await fillOpeningFixture.runner(false)
  })

  const leaveRoleFixture: LeaveRoleFixture = new LeaveRoleFixture(
    apiWrapper,
    leadKeyPair,
    sudo,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Leaving lead role', async () => leaveRoleFixture.runner(false))

  const decreaseStakeFailureFixture: DecreaseStakeFixture = new DecreaseStakeFixture(
    apiWrapper,
    nKeyPairs,
    leadKeyPair[0],
    sudo,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Decrease worker stake, expect failure', async () => decreaseStakeFailureFixture.runner(true))

  const addNewLeaderOpeningFixture: AddLeaderOpeningFixture = new AddLeaderOpeningFixture(
    apiWrapper,
    nKeyPairs,
    sudo,
    applicationStake,
    roleStake,
    openingActivationDelay,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Add lead opening', async () => await addNewLeaderOpeningFixture.runner(false))

  let applyForNewLeaderOpeningFixture: ApplyForOpeningFixture
  tap.test('Apply for lead opening', async () => {
    applyForNewLeaderOpeningFixture = new ApplyForOpeningFixture(
      apiWrapper,
      leadKeyPair,
      sudo,
      applicationStake,
      roleStake,
      addNewLeaderOpeningFixture.getResult()!,
      WorkingGroups.StorageWorkingGroup
    )
    await applyForNewLeaderOpeningFixture.runner(false)
  })

  let beginNewLeaderApplicationReviewFixture: BeginLeaderApplicationReviewFixture
  tap.test('Begin lead application review', async () => {
    beginNewLeaderApplicationReviewFixture = new BeginLeaderApplicationReviewFixture(
      apiWrapper,
      sudo,
      addNewLeaderOpeningFixture.getResult()!,
      WorkingGroups.StorageWorkingGroup
    )
    await beginNewLeaderApplicationReviewFixture.runner(false)
  })

  let fillNewLeaderOpeningFixture: FillLeaderOpeningFixture
  tap.test('Fill lead opening', async () => {
    fillNewLeaderOpeningFixture = new FillLeaderOpeningFixture(
      apiWrapper,
      leadKeyPair,
      sudo,
      addNewLeaderOpeningFixture.getResult()!,
      firstRewardInterval,
      rewardInterval,
      payoutAmount,
      WorkingGroups.StorageWorkingGroup
    )
    await fillNewLeaderOpeningFixture.runner(false)
  })

  const decreaseStakeFixture: DecreaseStakeFixture = new DecreaseStakeFixture(
    apiWrapper,
    nKeyPairs,
    leadKeyPair[0],
    sudo,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Decrease worker stake', async () => decreaseStakeFixture.runner(false))

  const slashFixture: SlashFixture = new SlashFixture(
    apiWrapper,
    nKeyPairs,
    leadKeyPair[0],
    sudo,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Slash worker', async () => slashFixture.runner(false))

  const terminateRoleFixture: TerminateRoleFixture = new TerminateRoleFixture(
    apiWrapper,
    nKeyPairs,
    leadKeyPair[0],
    sudo,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Terminate worker role', async () => terminateRoleFixture.runner(false))

  const newLeaveRoleFixture: LeaveRoleFixture = new LeaveRoleFixture(
    apiWrapper,
    leadKeyPair,
    sudo,
    WorkingGroups.StorageWorkingGroup
  )
  tap.test('Leaving lead role', async () => newLeaveRoleFixture.runner(false))

  closeApi(apiWrapper)
})