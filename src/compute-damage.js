import _ from 'lodash'
import { projectorToComparator, chainComparators } from 'subtender'

const allAswEquips = [
  {
    id: 46,name: "九三式水中聴音機",typeId: 14,asw: 6,
    accuracy: 1,evasion: 0,armor: 0,los: 0,type: "sonar"},
  {
    id: 47,name: "三式水中探信儀",typeId: 14,asw: 10,
    accuracy: 2,evasion: 0,armor: 0,los: 0,type: "sonar"},
  {
    id: 149,name: "四式水中聴音機",typeId: 14,asw: 12,
    accuracy: 1,evasion: 0,armor: 1,los: 0,type: "sonar"},
  {
    id: 260,name: "Type124 ASDIC",typeId: 14,asw: 11,
    accuracy: 2,evasion: 1,armor: 0,los: 0,type: "sonar",
  },
  {
    id: 261,name: "Type144/147 ASDIC",typeId: 14,asw: 13,
    accuracy: 3,evasion: 1,armor: 0,los: 0,type: "sonar",
  },
  {
    id: 262,name: "HF/DF + Type144/147 ASDIC",typeId: 14,asw: 15,
    accuracy: 3,evasion: 2,armor: 0,los: 2,type: "sonar",
  },
  {
    id: 44,name: "九四式爆雷投射機",typeId: 15,asw: 5,
    accuracy: 0,evasion: 0,armor: 0,los: 0,type: "dcp",
  },
  {
    id: 45,name: "三式爆雷投射機",typeId: 15,asw: 8,
    accuracy: 0,evasion: 0,armor: 0,los: 0,type: "dcp",
  },
  {
    id: 226,name: "九五式爆雷",typeId: 15,asw: 4,
    accuracy: 0,evasion: 0,armor: 0,los: 0,type: "dc",
  },
  {
    id: 227,name: "二式爆雷",typeId: 15,asw: 7,
    accuracy: 0,evasion: 0,armor: 0,los: 0,type: "dc",
  },
]

const findEquip = _.memoize(mstId =>
  allAswEquips.find(x => x.id === mstId)
)

const aswFormationConsts = {
  lineAhead: 1,
  doubleLine: 1.2,
  diamond: 1,
  echelon: 1.2,
  lineAbreast: 1.2,
  cruisingForm1: 1.3,
  cruisingForm2: 1.1,
  cruisingForm3: 1.0,
  cruisingForm4: .7,
}

const engagementConsts = {
  tAdv: 1.2,
  parallel: 1,
  headOn: .8,
  tDisadv: .6,
}

const describeConstsIntern = {
  tAdv: 'T字戦有利',
  parallel: '同航戦',
  headOn: '反航戦',
  tDisadv: 'T字戦不利',

  lineAhead: '単縦陣',
  doubleLine: '複縦陣',
  diamond: '輪形陣',
  echelon: '梯形陣',
  lineAbreast: '単横陣',
  cruisingForm1: '第一警戒航行序列（対潜警戒）',
  cruisingForm2: '第二警戒航行序列（前方警戒）',
  cruisingForm3: '第三警戒航行序列（輪形陣）',
  cruisingForm4: '第四警戒航行序列（戦闘隊形）',
}

const describeConsts = str =>
  (str in describeConstsIntern) ? describeConstsIntern[str] : str

const computeDamageAdvanced = args => {
  const {
    // 0 ~ 1
    ammoRate,
    // bool
    isCriticHit,
    modFormation,
    modEngagement,

    defendingArmor,
    // [0..defendingArmor-1], inclusive.
    defendingRnd,

    shipBaseAsw,
    aswTypeConst,
    /*
       Array of equipments.

       every equipment should have the following properties:
       - asw: number
       - type: sonar / dcp / dc
       - imp: 0 ~ 10 (improvement)
     */
    equips,
  } = args

  if (defendingRnd < 0 || defendingRnd > defendingArmor-1) {
    console.error(`violation: defendingRnd`)
    return NaN
  }

  const {
    modSynSonarDcp,
    modSynSonarDc,
    modSynDcDcp,
  } = (() => {
    const hasDc = equips.some(e => e.type === 'dc')
    const hasDcp = equips.some(e => e.type === 'dcp')
    const hasSonar = equips.some(e => e.type === 'sonar')
    return {
      modSynSonarDcp: hasSonar && hasDcp ? 1.15 : 1,
      modSynSonarDc: hasSonar && hasDc ? 0.15 : 0,
      modSynDcDcp: hasDc && hasDcp ? 0.1 : 0,
    }
  })()

  const aswEquips =
    equips.filter(e => ['dc', 'dcp', 'sonar', 'asw-aircraft'].includes(e.type))
  const eqpAsw = _.sum(aswEquips.map(e => e.asw))
  const eqpImpSum = _.sum(aswEquips.map(e => e.imp))

  const basicAttackPower =
    (
      2 * Math.sqrt(shipBaseAsw) +
      eqpImpSum +
      1.5 * eqpAsw +
      aswTypeConst
    ) *
    modSynSonarDcp *
    (1 + modSynSonarDc + modSynDcDcp)

  const defensePower =
    0.7*defendingArmor + 0.6*defendingRnd
  const modPre = modFormation * modEngagement
  const modCriticHit = isCriticHit ? 1.5 : 1
  const modPost = 1
  const remainingAmmoPenalty =
    ammoRate < 0.5 ? 2*ammoRate : 1
  const aswSoftCap = 150
  const cap = x => Math.floor(
    x > aswSoftCap ?
      aswSoftCap + Math.sqrt(x - aswSoftCap) :
      x
  )
  const capped = cap(basicAttackPower * modPre)
  return Math.floor(
    (
      Math.floor(capped * modCriticHit) * modPost -
      defensePower
    ) *
    remainingAmmoPenalty
  )
}

const computeDamageRange = inpArgs => {
  const {
    isCriticHit, // nondet
    formationStr, // fix
    engagementStr, // nondet
    shipBaseAsw, // fix
    aswTypeConst, // fix
    equips, // fix
    defendingArmor, // fix
  } = inpArgs

  const commonArgs = {
    ammoRate: 1,
    isCriticHit,
    modFormation: aswFormationConsts[formationStr],
    modEngagement: engagementConsts[engagementStr],
    defendingArmor,
    // defendingRnd: to be filled later
    shipBaseAsw,
    aswTypeConst,
    equips,
  }
  const dmgMin = computeDamageAdvanced({
    ...commonArgs,
    defendingRnd: defendingArmor-1,
  })
  const dmgMax = computeDamageAdvanced({
    ...commonArgs,
    defendingRnd: 0,
  })
  return [dmgMin, dmgMax]
}

// digest equip info by using "id" and "imp", can be used as key
const digestEquips = equips =>
  equips.sort(chainComparators(
    projectorToComparator(x => x.id),
    projectorToComparator(x => x.imp)
  )).map(({id,imp}) => `${id}-${imp}`).join('|')

// simpleEquips: Array of {id, imp}
const computeResultRows = (shipBaseAsw, formationStr, defendingArmor, slotCount, simpleEquips) => {
  const allEquips = simpleEquips.map(({id,imp}) => {
    const equipInfo = findEquip(id)
    const {asw,type} = equipInfo
    return {id,imp,asw,type}
  })

  const aswTypeConst = 13

  const pickM = n => curAllEquips => {
    // failure
    if (n < 0)
      return []

    // success with empty set
    if (n === 0)
      return [[]]

    // failure, nothing to pick
    if (n > 0 && curAllEquips.length === 0)
      return []

    // pick head element
    const [equip, ...restEquips] = curAllEquips
    const results = _.map(
      pickM(n-1)(restEquips),
      result => [equip, ...result]
    )

    return [...results, ...pickM(n)(restEquips)]
  }

  const equipsSearchSpaceInit = pickM(slotCount)(allEquips)
  const equipsSearchSpace = []
  {
    const tmpSet = new Set()
    equipsSearchSpaceInit.map(equips => {
      const digest = digestEquips(equips)
      if (! tmpSet.has(digest)) {
        tmpSet.add(digest)
        equipsSearchSpace.push(equips)
      }
    })
  }

  const results = equipsSearchSpace.map(equips => {
    const dmgInfo = _.mapValues(
      engagementConsts,
      (_v, engagementStr) => {
        const commonArgs = {
          formationStr,
          engagementStr,
          shipBaseAsw,
          aswTypeConst,
          equips,
          defendingArmor,
        }

        return {
          norm: computeDamageRange({
            ...commonArgs,
            isCriticHit: false,
          }),
          critic: computeDamageRange({
            ...commonArgs,
            isCriticHit: true,
          }),
        }
      }
    )
    const dmgWeight = _.mapValues(
      dmgInfo,
      ({norm, critic}) =>
        _.sum(norm) + _.sum(critic)
    )

    const weight =
      dmgWeight.tAdv * 15 +
      dmgWeight.parallel * 45 +
      dmgWeight.headOn * 30 +
      dmgWeight.tDisadv * 10

    return {
      dmgInfo,
      equips,
      weight,
    }
  })
  return _.take(results.sort((x,y) => y.weight - x.weight),20)
}

export {
  allAswEquips,
  findEquip,
  digestEquips,
  aswFormationConsts,
  engagementConsts,
  computeDamageAdvanced,
  computeDamageRange,
  computeResultRows,
  describeConsts,
}
