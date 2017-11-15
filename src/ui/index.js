import _ from 'lodash'
import {
  modifyObject,
  projectorToComparator,
  flipComparator,
  chainComparators,
} from 'subtender'
import React, { PureComponent } from 'react'
import {
  Panel,
  FormControl,
  Button,
  Table,
} from 'react-bootstrap'

import {
  allAswEquips,
  findEquip,
  digestEquips,
  aswFormationConsts,
  engagementConsts,
  computeResultRows,
} from '../compute-damage'

const defState = {
  shipBaseAsw: 81,
  formation: 'lineAbreast',
  defendingArmor: 47,
  slotCount: 3,
  equipsRaw: {
    // sonar
    46: '0,0,0,0',
    47: '0,0,0,0',
    149: '0,0,0,0',
    260: '0',
    261: '-',
    262: '-',
    // dcp
    44: '0,0,0,0',
    45: '0,0,0,0',
    // dc
    226: '0,0,0,0',
    227: '0,0',
  },
  results: [],
}

const parseSlot = raw => {
  if (/^\s*-?\s*$/.test(raw))
    return []
  const impsRaw = raw.split(',')
  if (impsRaw.length > 4)
    return null
  const elemRe = /^\s*(\d+|[xX])\s*$/
  const parseElement = rawElement => {
    const parsed = elemRe.exec(rawElement)
    if (!parsed)
      return null
    const [_ignored, rawE] = parsed
    if (rawE === 'x' || rawE === 'X')
      return 10
    const num = Number(rawE)
    if (num < 0 || num > 10)
      return null
    return num
  }
  const parsedSlots = impsRaw.map(parseElement)
  if (parsedSlots.some(x => x === null))
    return null

  return parsedSlots
}

class AswCalcMain extends PureComponent {
  constructor(props) {
    super(props)
    this.state = defState
  }

  handleReset = () =>
    this.setState(defState)

  handleChange = mkModifierFromRawValue => e => {
    const raw = e.target.value
    this.setState(mkModifierFromRawValue(raw))
  }

  handleCompute = () => {
    const {
      shipBaseAsw,
      formation,
      defendingArmor,
      slotCount,
      equipsRaw,
    } = this.state

    /* eslint-disable indent */
    const typeOrd = x =>
      x === 'sonar' ? 0 :
      x === 'dcp' ? 1 :
      x === 'dc'
    /* eslint-enable indent */

    const simpleEquips = _.flatMap(
      _.toPairs(equipsRaw),
      ([idStr, slotStr]) => {
        const id = Number(idStr)
        return parseSlot(slotStr).map(imp => ({id,imp}))
      }
    ).sort(chainComparators(
      // sort by category
      projectorToComparator(x => typeOrd(findEquip(x.id).type)),
      // sort by asw stat (reversed)
      flipComparator(
        projectorToComparator(x => findEquip(x.id).asw)
      ),
      // sort by id
      projectorToComparator(x => x.id),
      // sort by imp (reversed)
      flipComparator(
        projectorToComparator(x => x.imp)
      )
    ))

    const resultRows =
      computeResultRows(
        shipBaseAsw,
        formation,
        defendingArmor,
        slotCount,
        simpleEquips,
      )
    this.setState({results: resultRows})
  }

  render() {
    const {
      shipBaseAsw, formation, defendingArmor,
      slotCount, equipsRaw, results,
    } = this.state

    const inputValid = _.toPairs(equipsRaw).every(([_idStr, slotStr]) =>
      Array.isArray(parseSlot(slotStr)))

    return (
      <div
        style={{padding: 8, maxWidth: 1000}}
      >
        <Panel header="Parameters">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
            }}>
            <div style={{width: '50%'}}>Ship Base ASW</div>
            <FormControl
              onChange={
                this.handleChange(raw =>
                  modifyObject('shipBaseAsw', () => Number(raw))
                )
              }
              style={{flex: 1}}
              type="number"
              value={shipBaseAsw}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 5,
            }}>
            <div style={{width: '50%'}}>Formation</div>
            <FormControl
              onChange={
                this.handleChange(raw =>
                  modifyObject('formation', () => raw)
                )
              }
              style={{flex: 1}}
              componentClass="select" value={formation}>
              {
                Object.keys(aswFormationConsts).map(key => (
                  <option key={key} value={key}>{key}</option>
                ))
              }
            </FormControl>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 5,
            }}>
            <div style={{width: '50%'}}>Defending Armor</div>
            <FormControl
              onChange={
                this.handleChange(raw =>
                  modifyObject('defendingArmor', () => Number(raw))
                )
              }
              style={{flex: 1}}
              type="number"
              value={defendingArmor}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 5,
            }}>
            <div style={{width: '50%'}}>Slots</div>
            <FormControl
              onChange={
                this.handleChange(raw =>
                  modifyObject('slotCount', () => Number(raw))
                )
              }
              style={{flex: 1}}
              componentClass="select" value={slotCount}>
              {
                [2,3,4].map(key => (
                  <option key={key} value={key}>{key}</option>
                ))
              }
            </FormControl>
          </div>
          <div
            style={{display: 'flex', flexWrap: 'wrap'}}
          >
            {
              allAswEquips.map(equipInfo => (
                <div
                  key={equipInfo.id}
                  style={{
                    width: '48%',
                    display: 'flex',
                    alignItems: 'center',
                    margin: 5,
                  }}>
                  <div style={{width: '50%'}}>{equipInfo.name}</div>
                  <FormControl
                    onChange={
                      this.handleChange(raw =>
                        modifyObject(
                          'equipsRaw',
                          modifyObject(
                            equipInfo.id,
                            () => raw
                          )
                        )
                      )
                    }
                    style={{flex: 1}}
                    type="text" value={equipsRaw[equipInfo.id]}
                  />
                </div>
              ))
            }
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexDirection: 'row-reverse',
            }}
          >
            <Button
              bsStyle={inputValid ? 'success' : 'danger'}
              disabled={!inputValid}
              onClick={this.handleCompute}
            >
              Calculate
            </Button>
            <Button
              onClick={this.handleReset}
              style={{marginRight: 5}}>
              Reset
            </Button>
          </div>
        </Panel>
        <Panel
          header="Results">
          <Table
            style={{tableLayout: 'fixed'}}
            striped bordered condensed hover>
            <thead>
              <tr>
                <td>Equipments</td>
                {
                  Object.keys(engagementConsts).map(k => (
                    <td style={{width: '18%'}} key={k}>
                      {k}
                    </td>
                  ))
                }
              </tr>
            </thead>
            <tbody>
              {
                results.map(x => {
                  const {equips,dmgInfo} = x
                  const rangeToStr = ([min,max]) => `${min} ~ ${max}`
                  return (
                    <tr
                      key={digestEquips(equips)}>
                      <td
                        style={{verticalAlign: 'middle'}}
                      >
                        <div
                          style={{
                            width: '100%',
                            margin: 'auto',
                            paddingLeft: 5, paddingRight: 5,
                            display: 'flex',
                            flexDirection: 'column',
                          }}>
                          {
                            equips.map(({id,imp}) => {
                              const equipInfo = findEquip(id)
                              return (
                                <div
                                  style={{display: 'flex'}}
                                >
                                  <span style={{flex: 1}}>{equipInfo.name}</span>
                                  {
                                    imp > 0 && (<span>+{imp}</span>)
                                  }
                                </div>
                              )
                            })
                          }
                        </div>
                      </td>
                      {
                        Object.keys(engagementConsts).map(egmt => (
                          <td
                            style={{verticalAlign: 'middle'}}
                            key={egmt}>
                            <div
                              style={{
                                margin: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                              }}>
                              <div>{rangeToStr(dmgInfo[egmt].norm)}</div>
                              <div className="text-danger">{rangeToStr(dmgInfo[egmt].critic)}</div>
                            </div>
                          </td>
                        ))
                      }
                    </tr>
                  )
                })
              }
            </tbody>
          </Table>
        </Panel>
      </div>
    )
  }
}

export { AswCalcMain }