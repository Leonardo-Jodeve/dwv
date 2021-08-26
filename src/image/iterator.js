// namespaces
var dwv = dwv || {};
dwv.image = dwv.image || {};

/**
 * Get an simple iterator for a given range for a one component data.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
 * @param {Function} dataAccessor Function to access data.
 * @param {number} start The start of the range (included).
 * @param {number} end The end of the range (excluded).
 * @param {number} increment The increment between indicies (default=1).
 * @returns {object} An iterator folowing the iterator and iterable protocol.
 */
dwv.image.simpleRange = function (dataAccessor, start, end, increment) {
  if (typeof increment === 'undefined') {
    increment = 1;
  }
  var nextIndex = start;
  // result
  return {
    next: function () {
      if (nextIndex < end) {
        var result = {
          value: dataAccessor(nextIndex),
          done: false
        };
        nextIndex += increment;
        return result;
      }
      return {
        done: true,
        index: end
      };
    }
  };
};

/**
 * Get an iterator for a given range for a one component data.
 *
 * @param {Function} dataAccessor Function to access data.
 * @param {number} start Zero-based index at which to start the iteration.
 * @param {number} end Zero-based index at which to end the iteration.
 * @param {number} increment Increment between indicies.
 * @param {number} countMax Number of applied increment after which
 *   countIncrement is applied.
 * @param {number} countIncrement Increment after countMax is reached,
 *   the value is from count start to the next count start.
 * @param {boolean} reverse1 If true, loop from end to start.
 * @param {boolean} reverse2 If true, loop from count end to count start.
 * @returns {object} An iterator folowing the iterator and iterable protocol.
 */
dwv.image.range = function (dataAccessor, start, end, increment,
  countMax, countIncrement, reverse1, reverse2) {
  if (typeof reverse1 === 'undefined') {
    reverse1 = false;
  }
  if (typeof reverse2 === 'undefined') {
    reverse2 = false;
  }

  // first index of the iteration
  var nextIndex;
  // adapt first index and increments to reverse values
  if (reverse1) {
    nextIndex = end;
    countIncrement *= -1;
    if (reverse2) {
      nextIndex -= (countMax - 1) * increment;
    } else {
      increment *= -1;
    }
  } else {
    nextIndex = start;
    if (reverse2) {
      nextIndex += (countMax - 1) * increment;
      increment *= -1;
    }
  }
  var finalCountIncrement = countIncrement - countMax * increment;

  // test index function
  var testIndex = function (i) {
    return i <= end;
  };
  if (reverse1) {
    testIndex = function (i) {
      return i >= start;
    };
  }
  var count = 0;
  // result
  return {
    next: function () {
      if (testIndex(nextIndex)) {
        var result = {
          value: dataAccessor(nextIndex),
          done: false
        };
        nextIndex += increment;
        ++count;
        if (count === countMax) {
          count = 0;
          nextIndex += finalCountIncrement;
        }
        return result;
      }
      return {
        done: true,
        index: end
      };
    }
  };
};

/**
 * Get an iterator for a given range with bounds (for a one component data).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
 * @param {Function} dataAccessor Function to access data.
 * @param {number} start The start of the range (included).
 * @param {number} end The end of the range (excluded).
 * @param {number} increment The increment between indicies.
 * @param {number} regionSize The size of the region to iterate through.
 * @param {number} regionOffset The offset between regions.
 * @returns {object} An iterator folowing the iterator and iterable protocol.
 */
dwv.image.rangeRegion = function (
  dataAccessor, start, end, increment, regionSize, regionOffset) {
  var nextIndex = start;
  var regionElementCount = 0;
  // result
  return {
    next: function () {
      if (nextIndex < end) {
        var result = {
          value: dataAccessor(nextIndex),
          done: false
        };
        regionElementCount += 1;
        nextIndex += increment;
        if (regionElementCount === regionSize) {
          regionElementCount = 0;
          nextIndex += regionOffset;
        }
        return result;
      }
      return {
        done: true,
        index: end
      };
    }
  };
};

/**
 * Get an iterator for a given range with bounds (for a one component data).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
 * @param {Function} dataAccessor Function to access data.
 * @param {number} start The start of the range (included).
 * @param {number} end The end of the range (excluded).
 * @param {number} increment The increment between indicies.
 * @param {Array} regions An array of regions: [off0, size, off1].
 * @returns {object} An iterator folowing the iterator and iterable protocol.
 */
dwv.image.rangeRegions = function (
  dataAccessor, start, end, increment, regions) {
  var nextIndex = start;
  var regionCount = 0;
  var regionElementCount = 0;
  // result
  return {
    next: function () {
      if (nextIndex < end) {
        var result = {
          value: dataAccessor(nextIndex),
          done: false
        };
        regionElementCount += 1;
        nextIndex += increment;
        if (regionElementCount === regions[regionCount][1]) {
          regionElementCount = 0;
          // off1 of current group
          nextIndex += regions[regionCount][2];
          regionCount += 1;
          // off0 of next group
          if (regionCount < regions.length) {
            nextIndex += regions[regionCount][0];
          }
        }
        return result;
      }
      return {
        done: true,
        index: end
      };
    }
  };
};

/**
 * Get an iterator for a given range for a 3 components data.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
 * @param {Function} dataAccessor Function to access data.
 * @param {number} start The start of the range (included).
 * @param {number} end The end of the range (excluded).
 *   (end - start) needs to be a multiple of 3...
 * @param {number} increment The increment between indicies (default=1).
 * @param {boolean} isPlanar A flag to know if the data is planar
 *   (RRRR...GGGG...BBBB...) or not (RGBRGBRGBRGB...), defaults to false.
 * @returns {object} A 3 components iterator folowing the iterator and iterable
 *   protocol, with extra 'value1' and 'value2' for the second and
 *   third component.
 */
dwv.image.range3d = function (dataAccessor, start, end, increment, isPlanar) {
  if (typeof increment === 'undefined') {
    increment = 1;
  }
  if (typeof isPlanar === 'undefined') {
    isPlanar = false;
  }
  var nextIndex = start;
  var componentIncrement = 1;
  if (isPlanar) {
    componentIncrement = (end - start) / 3;
  } else {
    increment *= 3;
  }
  var nextIndex1 = nextIndex + componentIncrement;
  var nextIndex2 = nextIndex + 2 * componentIncrement;

  // result
  return {
    next: function () {
      if (nextIndex < end) {
        var result = {
          value: [
            dataAccessor(nextIndex),
            dataAccessor(nextIndex1),
            dataAccessor(nextIndex2)
          ],
          done: false
        };
        nextIndex += increment;
        nextIndex1 += increment;
        nextIndex2 += increment;
        return result;
      }
      return {
        done: true,
        index: [end]
      };
    }
  };
};

/**
 * Get a list of values for a given iterator.
 *
 * @param {object} iterator The iterator to use to loop through data.
 * @returns {Array} The list of values.
 */
dwv.image.getIteratorValues = function (iterator) {
  var values = [];
  var ival = iterator.next();
  while (!ival.done) {
    values.push(ival.value);
    ival = iterator.next();
  }
  return values;
};

/**
 * Get a slice index iterator.
 *
 * @param {object} image The image to parse.
 * @param {object} position The current position.
 * @param {boolean} isRescaled Flag for rescaled values (default false).
 * @param {object} viewOrientation The view orientation.
 * @returns {object} The slice iterator.
 */
dwv.image.getSliceIterator = function (
  image, position, isRescaled, viewOrientation) {
  var geometry = image.getGeometry();
  // zero-ify non direction index
  var dirMax2Index = 2;
  if (viewOrientation && typeof viewOrientation !== 'undefined') {
    dirMax2Index = viewOrientation.getColAbsMax(2).index;
  }
  var posValues = position.getValues();
  var indexFilter = function (element, index) {
    return index === dirMax2Index ? element : 0;
  };
  var posStart = new dwv.math.Index(posValues.map(indexFilter));
  var start = geometry.indexToOffset(posStart);

  // default to non rescaled data
  if (typeof isRescaled === 'undefined') {
    isRescaled = false;
  }
  var dataAccessor = null;
  if (isRescaled) {
    dataAccessor = function (offset) {
      return image.getRescaledValueAtOffset(offset);
    };
  } else {
    dataAccessor = function (offset) {
      return image.getValueAtOffset(offset);
    };
  }

  var size = geometry.getSize();
  var ncols = size.get(0);
  var nrows = size.get(1);
  var nslices = size.get(2);
  var sliceSize = size.getDimSize(2);

  var range = null;
  if (image.getNumberOfComponents() === 1) {
    if (viewOrientation && typeof viewOrientation !== 'undefined') {
      var dirMax0 = viewOrientation.getColAbsMax(0);
      var dirMax2 = viewOrientation.getColAbsMax(2);

      // first pixel: top left -> inverts left/right, top/bottom...
      // => default is reverse=true
      var reverse1 = true;
      var reverse2 = true;

      var end = null;
      if (dirMax2.index === 2) {
        // axial: xyz or yxz
        end = start + sliceSize - 1;
        if (dirMax0.index === 0) {
          // xyz (r1:0, r2:0)
          reverse1 = !reverse1;
          reverse2 = !reverse2;
          range = dwv.image.range(dataAccessor,
            start, end, 1, ncols, ncols, reverse1, reverse2);
        } else {
          // yxz  (r1:1, r2:0, guessed... no data...)
          reverse1 = true;
          reverse2 = !reverse2;
          range = dwv.image.range(dataAccessor,
            start, end, ncols, nrows, 1, reverse1, reverse2);
        }
      } else if (dirMax2.index === 0) {
        // sagittal: yzx or zyx
        end = start + (nslices - 1) * sliceSize +
          ncols * (nrows - 1);
        if (dirMax0.index === 1) {
          // yzx (r1:1, r2:1)
          range = dwv.image.range(dataAccessor,
            start, end, ncols, nrows, sliceSize, reverse1, reverse2);
        } else {
          // zyx (r1:0, r2:1)
          reverse1 = !reverse1;
          range = dwv.image.range(dataAccessor,
            start, end, sliceSize, nslices, ncols, reverse1, reverse2);
        }
      } else if (dirMax2.index === 1) {
        // coronal: xzy or zxy
        end = start + (nslices - 1) * sliceSize + ncols - 1;
        if (dirMax0.index === 0) {
          // xzy (r1:1, r2:1)
          range = dwv.image.range(dataAccessor,
            start, end, 1, ncols, sliceSize, reverse1, reverse2);
        } else {
          // zxy (r0:1, r2:1)
          reverse1 = !reverse1;
          range = dwv.image.range(dataAccessor,
            start, end, sliceSize, nslices, 1, reverse1, reverse2);
        }
      } else {
        throw new Error('Unknown direction: ' + dirMax2.index);
      }
    } else {
      // default case
      range = dwv.image.simpleRange(dataAccessor, start, start + sliceSize);
    }
  } else if (image.getNumberOfComponents() === 3) {
    // 3 times bigger...
    start *= 3;
    sliceSize *= 3;
    var isPlanar = image.getPlanarConfiguration() === 1;
    range = dwv.image.range3d(
      dataAccessor, start, start + sliceSize, 1, isPlanar);
  } else {
    throw new Error('Unsupported number of components: ' +
      image.getNumberOfComponents());
  }

  return range;
};

/**
 * Get a slice index iterator for a rectangular region.
 *
 * @param {object} image The image to parse.
 * @param {object} position The current position.
 * @param {boolean} isRescaled Flag for rescaled values (default false).
 * @param {dwv.math.Point2D} min The minimum position (optional).
 * @param {dwv.math.Point2D} max The maximum position (optional).
 * @returns {object} The slice iterator.
 */
dwv.image.getRegionSliceIterator = function (
  image, position, isRescaled, min, max) {
  if (image.getNumberOfComponents() !== 1) {
    throw new Error('Unsupported number of components for region iterator: ' +
      image.getNumberOfComponents());
  }

  // default to non rescaled data
  if (typeof isRescaled === 'undefined') {
    isRescaled = false;
  }
  var dataAccessor = null;
  if (isRescaled) {
    dataAccessor = function (offset) {
      return image.getRescaledValueAtOffset(offset);
    };
  } else {
    dataAccessor = function (offset) {
      return image.getValueAtOffset(offset);
    };
  }

  var geometry = image.getGeometry();
  var size = geometry.getSize();
  if (typeof min === 'undefined') {
    min = new dwv.math.Point2D(0, 0);
  }
  if (typeof max === 'undefined') {
    max = new dwv.math.Point2D(
      size.get(0) - 1,
      size.get(1)
    );
  }
  // position to pixel for max: extra X is ok, remove extra Y
  var startOffset = geometry.indexToOffset(position.getWithNew2D(
    min.getX(), min.getY()
  ));
  var endOffset = geometry.indexToOffset(position.getWithNew2D(
    max.getX(), max.getY() - 1
  ));

  // minimum 1 column
  var rangeNumberOfColumns = Math.max(1, max.getX() - min.getX());
  var rowIncrement = size.get(0) - rangeNumberOfColumns;

  return dwv.image.rangeRegion(
    dataAccessor, startOffset, endOffset + 1,
    1, rangeNumberOfColumns, rowIncrement);
};

/**
 * Get a slice index iterator for a rectangular region.
 *
 * @param {object} image The image to parse.
 * @param {object} position The current position.
 * @param {boolean} isRescaled Flag for rescaled values (default false).
 * @param {Array} regions An array of regions.
 * @returns {object} The slice iterator.
 */
dwv.image.getVariableRegionSliceIterator = function (
  image, position, isRescaled, regions) {
  if (image.getNumberOfComponents() !== 1) {
    throw new Error('Unsupported number of components for region iterator: ' +
      image.getNumberOfComponents());
  }

  // default to non rescaled data
  if (typeof isRescaled === 'undefined') {
    isRescaled = false;
  }
  var dataAccessor = null;
  if (isRescaled) {
    dataAccessor = function (offset) {
      return image.getRescaledValueAtOffset(offset);
    };
  } else {
    dataAccessor = function (offset) {
      return image.getValueAtOffset(offset);
    };
  }

  var geometry = image.getGeometry();
  var size = geometry.getSize();

  var offsetRegions = [];
  var region;
  var min = null;
  var max = null;
  var index = null;
  for (var i = 0; i < regions.length; ++i) {
    region = regions[i];
    var width = region[1][0] - region[0][0];
    if (width !== 0) {
      index = i;
      if (!min) {
        min = region[0];
      }
      offsetRegions.push([
        region[0][0],
        width,
        size.get(0) - region[1][0]
      ]);
    }
  }
  if (index !== null) {
    max = regions[index][1];
  }

  // exit if no offsets
  if (offsetRegions.length === 0) {
    return;
  }

  var startOffset = geometry.indexToOffset(position.getWithNew2D(
    min[0], min[1]
  ));
  var endOffset = geometry.indexToOffset(position.getWithNew2D(
    max[0], max[1]
  ));

  return dwv.image.rangeRegions(
    dataAccessor, startOffset, endOffset + 1,
    1, offsetRegions);
};
