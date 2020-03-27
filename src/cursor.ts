import { isObject, Callback, Predicate } from './util'
import { Aggregator } from './aggregator'
import { Lazy, Iterator } from './lazy'
import { CollationSpec } from './operators/pipeline/sort'

/**
 * Cursor to iterate and perform filtering on matched objects
 * @param collection
 * @param query
 * @param projection
 * @constructor
 */
export class Cursor {

  private __filterFn: Callback<any>
  private __source: object[]
  private __projection: object
  private __operators: object[]
  private __result: Iterator
  private __stack: any[]
  private __options: object

  constructor(source: object[], filterFn: Predicate<any>, projection?: object) {
    this.__filterFn = filterFn
    this.__source = source
    this.__projection = projection
    this.__operators = []
    this.__result = null
    this.__stack = []
    this.__options = {}
  }

  _fetch() {

    if (!!this.__result) return this.__result

    // add projection operator
    if (isObject(this.__projection)) this.__operators.push({ '$project': this.__projection })

    // filter collection
    this.__result = Lazy(this.__source).filter(this.__filterFn)

    if (this.__operators.length > 0) {
      this.__result = (new Aggregator(this.__operators, this.__options)).stream(this.__result)
    }

    return this.__result
  }

  /**
   * Return remaining objects in the cursor as an array. This method exhausts the cursor
   * @returns {Array}
   */
  all(): any[] {
    return this._fetch().value()
  }

  /**
   * Returns the number of objects return in the cursor. This method exhausts the cursor
   * @returns {Number}
   */
  count(): number {
    return this.all().length
  }

  /**
   * Returns a cursor that begins returning results only after passing or skipping a number of documents.
   * @param {Number} n the number of results to skip.
   * @return {Cursor} Returns the cursor, so you can chain this call.
   */
  skip(n: number): Cursor {
    this.__operators.push({ '$skip': n })
    return this
  }

  /**
   * Constrains the size of a cursor's result set.
   * @param {Number} n the number of results to limit to.
   * @return {Cursor} Returns the cursor, so you can chain this call.
   */
  limit(n: number): Cursor {
    this.__operators.push({ '$limit': n })
    return this
  }

  /**
   * Returns results ordered according to a sort specification.
   * @param {Object} modifier an object of key and values specifying the sort order. 1 for ascending and -1 for descending
   * @return {Cursor} Returns the cursor, so you can chain this call.
   */
  sort(modifier: any): Cursor {
    this.__operators.push({ '$sort': modifier })
    return this
  }

  /**
   * Specifies the collation for the cursor returned by the `mingo.Query.find`
   * @param {*} options
   */
  collation(options: CollationSpec): Cursor {
    this.__options['collation'] = options
    return this
  }

  /**
   * Returns the next document in a cursor.
   * @returns {Object | Boolean}
   */
  next(): any {
    if (!this.__stack) return // done
    if (this.__stack.length > 0) return this.__stack.pop() // yield value obtains in hasNext()
    let o = this._fetch().next()

    if (!o.done) return o.value
    this.__stack = null
    return
  }

  /**
   * Returns true if the cursor has documents and can be iterated.
   * @returns {boolean}
   */
  hasNext(): boolean {
    if (!this.__stack) return false // done
    if (this.__stack.length > 0) return true // there is a value on stack

    let o = this._fetch().next()
    if (!o.done) {
      this.__stack.push(o.value)
    } else {
      this.__stack = null
    }

    return !!this.__stack
  }

  /**
   * Applies a function to each document in a cursor and collects the return values in an array.
   * @param callback
   * @returns {Array}
   */
  map(callback: Callback<any>): any[] {
    return this._fetch().map(callback).value()
  }

  /**
   * Applies a JavaScript function for every document in a cursor.
   * @param callback
   */
  forEach(callback: Callback<any>) {
    this._fetch().each(callback)
  }
}

if (typeof Symbol === 'function') {
  /**
   * Applies an [ES2015 Iteration protocol][] compatible implementation
   * [ES2015 Iteration protocol]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   * @returns {Object}
   */
  Cursor.prototype[Symbol.iterator] = function () {
    return this._fetch()
  }
}