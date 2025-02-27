// namespaces
var dwv = dwv || {};
/** @namespace */
dwv.image = dwv.image || {};

/**
 * Image class.
 * Usable once created, optional are:
 * - rescale slope and intercept (default 1:0),
 * - photometric interpretation (default MONOCHROME2),
 * - planar configuration (default RGBRGB...).
 *
 * @class
 * @param {dwv.image.Geometry} geometry The geometry of the image.
 * @param {Array} buffer The image data as a one dimensional buffer.
 * @param {Array} imageUids An array of Uids indexed to slice number.
 */
dwv.image.Image = function (geometry, buffer, imageUids) {

  /**
   * Constant rescale slope and intercept (default).
   *
   * @private
   * @type {object}
   */
  var rsi = new dwv.image.RescaleSlopeAndIntercept(1, 0);
  /**
   * Varying rescale slope and intercept.
   *
   * @private
   * @type {Array}
   */
  var rsis = null;
  /**
   * Flag to know if the RSIs are all identity (1,0).
   *
   * @private
   * @type {boolean}
   */
  var isIdentityRSI = true;
  /**
   * Flag to know if the RSIs are all equals.
   *
   * @private
   * @type {boolean}
   */
  var isConstantRSI = true;
  /**
   * Photometric interpretation (MONOCHROME, RGB...).
   *
   * @private
   * @type {string}
   */
  var photometricInterpretation = 'MONOCHROME2';
  /**
   * Planar configuration for RGB data (0:RGBRGBRGBRGB... or
   *   1:RRR...GGG...BBB...).
   *
   * @private
   * @type {number}
   */
  var planarConfiguration = 0;
  /**
   * Number of components.
   *
   * @private
   * @type {number}
   */
  var numberOfComponents = buffer.length / (
    geometry.getSize().getTotalSize());
  /**
   * Meta information.
   *
   * @private
   * @type {object}
   */
  var meta = {};

  /**
   * Data range.
   *
   * @private
   * @type {object}
   */
  var dataRange = null;
  /**
   * Rescaled data range.
   *
   * @private
   * @type {object}
   */
  var rescaledDataRange = null;
  /**
   * Histogram.
   *
   * @private
   * @type {Array}
   */
  var histogram = null;

  /**
   * Listener handler.
   *
   * @private
   * @type {object}
   */
  var listenerHandler = new dwv.utils.ListenerHandler();

  /**
   * Get the image UID at a given index.
   *
   * @param {dwv.math.Index} index The index at which to get the id.
   * @returns {string} The UID.
   */
  this.getImageUid = function (index) {
    var uid = imageUids[0];
    if (imageUids.length !== 1 && typeof index !== 'undefined') {
      uid = imageUids[this.getSecondaryOffset(index)];
    }
    return uid;
  };

  /**
   * Get the geometry of the image.
   *
   * @returns {dwv.image.Geometry} The geometry.
   */
  this.getGeometry = function () {
    return geometry;
  };

  /**
   * Get the data buffer of the image.
   *
   * @todo dangerous...
   * @returns {Array} The data buffer of the image.
   */
  this.getBuffer = function () {
    return buffer;
  };

  /**
   * Can the image values be quantified?
   *
   * @returns {boolean} True if only one component.
   */
  this.canQuantify = function () {
    return this.getNumberOfComponents() === 1;
  };

  /**
   * Can window and level be applied to the data?
   *
   * @returns {boolean} True if the data is monochrome.
   */
  this.canWindowLevel = function () {
    return this.getPhotometricInterpretation()
      .match(/MONOCHROME/) !== null;
  };

  /**
   * Can the data be scrolled?
   *
   * @param {dwv.math.Matrix33} viewOrientation The view orientation.
   * @returns {boolean} True if the data has a third dimension greater than one
   *   after applying the view orientation.
   */
  this.canScroll = function (viewOrientation) {
    var size = this.getGeometry().getSize();
    // also check the numberOfFiles in case we are in the middle of a load
    var nFiles = 1;
    if (typeof meta.numberOfFiles !== 'undefined') {
      nFiles = meta.numberOfFiles;
    }
    return size.canScroll(viewOrientation) || nFiles !== 1;
  };

  /**
   * Get the secondary offset max.
   *
   * @returns {number} The maximum offset.
   */
  function getSecondaryOffsetMax() {
    return geometry.getSize().getTotalSize(2);
  }

  /**
   * Get the secondary offset: an offset that takes into account
   *   the slice and above dimension numbers.
   *
   * @param {dwv.math.Index} index The index.
   * @returns {number} The offset.
   */
  this.getSecondaryOffset = function (index) {
    return geometry.getSize().indexToOffset(index, 2);
  };

  /**
   * Get the rescale slope and intercept.
   *
   * @param {dwv.math.Index} index The index (only needed for non constant rsi).
   * @returns {object} The rescale slope and intercept.
   */
  this.getRescaleSlopeAndIntercept = function (index) {
    var res = rsi;
    if (!this.isConstantRSI()) {
      if (typeof index === 'undefined') {
        throw new Error('Cannot get non constant RSI with empty slice index.');
      }
      var offset = this.getSecondaryOffset(index);
      if (typeof rsis[offset] !== 'undefined') {
        res = rsis[offset];
      } else {
        dwv.logger.warn('undefined non constant rsi at ' + offset);
      }
    }
    return res;
  };

  /**
   * Get the rsi at a specified (secondary) offset.
   *
   * @param {number} offset The desired (secondary) offset.
   * @returns {object} The coresponding rsi.
   */
  function getRescaleSlopeAndInterceptAtOffset(offset) {
    return rsis[offset];
  }

  /**
   * Set the rescale slope and intercept.
   *
   * @param {object} inRsi The input rescale slope and intercept.
   * @param {number} offset The rsi offset (only needed for non constant rsi).
   */
  this.setRescaleSlopeAndIntercept = function (inRsi, offset) {
    // update identity flag
    isIdentityRSI = isIdentityRSI && inRsi.isID();
    // update constant flag
    if (!isConstantRSI) {
      if (typeof index === 'undefined') {
        throw new Error(
          'Cannot store non constant RSI with empty slice index.');
      }
      rsis.splice(offset, 0, inRsi);
    } else {
      if (!rsi.equals(inRsi)) {
        if (typeof index === 'undefined') {
          // no slice index, replace existing
          rsi = inRsi;
        } else {
          // first non constant rsi
          isConstantRSI = false;
          // switch to non constant mode
          rsis = [];
          // initialise RSIs
          for (var i = 0, leni = getSecondaryOffsetMax(); i < leni; ++i) {
            rsis.push(i);
          }
          // store
          rsi = null;
          rsis.splice(offset, 0, inRsi);
        }
      }
    }
  };
  /**
   * Are all the RSIs identity (1,0).
   *
   * @returns {boolean} True if they are.
   */
  this.isIdentityRSI = function () {
    return isIdentityRSI;
  };
  /**
   * Are all the RSIs equal.
   *
   * @returns {boolean} True if they are.
   */
  this.isConstantRSI = function () {
    return isConstantRSI;
  };
  /**
   * Get the photometricInterpretation of the image.
   *
   * @returns {string} The photometricInterpretation of the image.
   */
  this.getPhotometricInterpretation = function () {
    return photometricInterpretation;
  };
  /**
   * Set the photometricInterpretation of the image.
   *
   * @param {string} interp The photometricInterpretation of the image.
   */
  this.setPhotometricInterpretation = function (interp) {
    photometricInterpretation = interp;
  };
  /**
   * Get the planarConfiguration of the image.
   *
   * @returns {number} The planarConfiguration of the image.
   */
  this.getPlanarConfiguration = function () {
    return planarConfiguration;
  };
  /**
   * Set the planarConfiguration of the image.
   *
   * @param {number} config The planarConfiguration of the image.
   */
  this.setPlanarConfiguration = function (config) {
    planarConfiguration = config;
  };
  /**
   * Get the numberOfComponents of the image.
   *
   * @returns {number} The numberOfComponents of the image.
   */
  this.getNumberOfComponents = function () {
    return numberOfComponents;
  };

  /**
   * Get the meta information of the image.
   *
   * @returns {object} The meta information of the image.
   */
  this.getMeta = function () {
    return meta;
  };
  /**
   * Set the meta information of the image.
   *
   * @param {object} rhs The meta information of the image.
   */
  this.setMeta = function (rhs) {
    meta = rhs;
  };

  /**
   * Get value at offset. Warning: No size check...
   *
   * @param {number} offset The desired offset.
   * @returns {number} The value at offset.
   */
  this.getValueAtOffset = function (offset) {
    return buffer[offset];
  };

  /**
   * Clone the image.
   *
   * @returns {Image} A clone of this image.
   */
  this.clone = function () {
    // clone the image buffer
    var clonedBuffer = buffer.slice(0);
    // create the image copy
    var copy = new dwv.image.Image(this.getGeometry(), clonedBuffer, imageUids);
    // copy the RSI(s)
    if (this.isConstantRSI()) {
      copy.setRescaleSlopeAndIntercept(this.getRescaleSlopeAndIntercept());
    } else {
      for (var i = 0; i < getSecondaryOffsetMax(); ++i) {
        copy.setRescaleSlopeAndIntercept(
          getRescaleSlopeAndInterceptAtOffset(i), i);
      }
    }
    // copy extras
    copy.setPhotometricInterpretation(this.getPhotometricInterpretation());
    copy.setPlanarConfiguration(this.getPlanarConfiguration());
    copy.setMeta(this.getMeta());
    // return
    return copy;
  };

  /**
   * Re-allocate buffer memory to an input size.
   *
   * @param {number} size The new size.
   */
  function realloc(size) {
    // save buffer
    var tmpBuffer = buffer;
    // create new
    buffer = dwv.dicom.getTypedArray(
      buffer.BYTES_PER_ELEMENT * 8,
      meta.IsSigned ? 1 : 0,
      size);
    if (buffer === null) {
      throw new Error('Cannot reallocate data for image.');
    }
    // put old in new
    buffer.set(tmpBuffer);
    // clean
    tmpBuffer = null;
  }

  /**
   * Append a slice to the image.
   *
   * @param {Image} rhs The slice to append.
   * @param {number} timeId An optional time ID.
   */
  this.appendSlice = function (rhs, timeId) {
    if (typeof timeId === 'undefined') {
      timeId = 0;
    }
    // check input
    if (rhs === null) {
      throw new Error('Cannot append null slice');
    }
    var rhsSize = rhs.getGeometry().getSize();
    var size = geometry.getSize();
    if (rhsSize.get(2) !== 1) {
      throw new Error('Cannot append more than one slice');
    }
    if (size.get(0) !== rhsSize.get(0)) {
      throw new Error('Cannot append a slice with different number of columns');
    }
    if (size.get(1) !== rhsSize.get(1)) {
      throw new Error('Cannot append a slice with different number of rows');
    }
    if (!geometry.getOrientation().equals(
      rhs.getGeometry().getOrientation(), 0.0001)) {
      throw new Error('Cannot append a slice with different orientation');
    }
    if (photometricInterpretation !== rhs.getPhotometricInterpretation()) {
      throw new Error(
        'Cannot append a slice with different photometric interpretation');
    }
    // all meta should be equal
    for (var key in meta) {
      if (key === 'windowPresets' || key === 'numberOfFiles') {
        continue;
      }
      if (meta[key] !== rhs.getMeta()[key]) {
        throw new Error('Cannot append a slice with different ' + key);
      }
    }

    // calculate slice size
    var sliceSize = numberOfComponents * size.getDimSize(2);

    // create full buffer if not done yet
    if (typeof meta.numberOfFiles === 'undefined') {
      throw new Error('Missing number of files for buffer manipulation.');
    }
    var fullBufferSize = sliceSize * meta.numberOfFiles;
    if (size.length() === 4) {
      fullBufferSize *= size.get(3);
    }
    if (buffer.length !== fullBufferSize) {
      realloc(fullBufferSize);
    }

    var newSliceIndex = geometry.getSliceIndex(rhs.getGeometry().getOrigin());
    var values = new Array(geometry.getSize().length());
    values.fill(0);
    values[2] = newSliceIndex;
    if (size.length() === 4) {
      values[3] = timeId;
    }
    var index = new dwv.math.Index(values);
    var primaryOffset = size.indexToOffset(index) * numberOfComponents;
    var secondaryOffset = this.getSecondaryOffset(index) * numberOfComponents;

    // first frame special slice by slice append
    if (timeId === 0) {
      // store slice
      var oldNumberOfSlices = size.get(2);
      // move content if needed
      var start = primaryOffset;
      var end;
      if (newSliceIndex === 0) {
        // insert slice before current data
        end = start + oldNumberOfSlices * sliceSize;
        buffer.set(
          buffer.subarray(start, end),
          primaryOffset + sliceSize
        );
      } else if (newSliceIndex < oldNumberOfSlices) {
        // insert slice in between current data
        end = start + (oldNumberOfSlices - newSliceIndex) * sliceSize;
        buffer.set(
          buffer.subarray(start, end),
          primaryOffset + sliceSize
        );
      }
    }

    // add new slice content
    buffer.set(rhs.getBuffer(), primaryOffset);

    // update geometry
    if (timeId === 0) {
      geometry.appendOrigin(rhs.getGeometry().getOrigin(), newSliceIndex);
    }
    // update rsi
    // (rhs should just have one rsi)
    this.setRescaleSlopeAndIntercept(
      rhs.getRescaleSlopeAndIntercept(), secondaryOffset);

    // current number of images
    var numberOfImages = imageUids.length;

    // insert sop instance UIDs
    imageUids.splice(secondaryOffset, 0, rhs.getImageUid());

    // update window presets
    if (typeof meta.windowPresets !== 'undefined') {
      var windowPresets = meta.windowPresets;
      var rhsPresets = rhs.getMeta().windowPresets;
      var keys = Object.keys(rhsPresets);
      var pkey = null;
      for (var i = 0; i < keys.length; ++i) {
        pkey = keys[i];
        var rhsPreset = rhsPresets[pkey];
        var windowPreset = windowPresets[pkey];
        if (typeof windowPreset !== 'undefined') {
          // if not set or false, check perslice
          if (typeof windowPreset.perslice === 'undefined' ||
            windowPreset.perslice === false) {
            // if different preset.wl, mark it as perslice
            if (!windowPreset.wl[0].equals(rhsPreset.wl[0])) {
              windowPreset.perslice = true;
              // fill wl array with copy of wl[0]
              // (loop on number of images minus the existing one)
              for (var j = 0; j < numberOfImages - 1; ++j) {
                windowPreset.wl.push(windowPreset.wl[0]);
              }
            }
          }
          // store (first) rhs preset.wl if needed
          if (typeof windowPreset.perslice !== 'undefined' &&
            windowPreset.perslice === true) {
            windowPresets[pkey].wl.splice(
              secondaryOffset, 0, rhsPreset.wl[0]);
          }
        } else {
          // if not defined (it should be), store all
          windowPresets[pkey] = rhsPresets[pkey];
        }
      }
    }
  };

  /**
   * Append a frame buffer to the image.
   *
   * @param {object} frameBuffer The frame buffer to append.
   * @param {number} frameIndex The frame index.
   */
  this.appendFrameBuffer = function (frameBuffer, frameIndex) {
    // create full buffer if not done yet
    var size = geometry.getSize();
    var frameSize = numberOfComponents * size.getDimSize(2);
    if (typeof meta.numberOfFiles === 'undefined') {
      throw new Error('Missing number of files for frame buffer manipulation.');
    }
    var fullBufferSize = frameSize * meta.numberOfFiles;
    if (buffer.length !== fullBufferSize) {
      realloc(fullBufferSize);
    }
    // append
    if (frameIndex >= meta.numberOfFiles) {
      throw new Error(
        'Cannot append a frame at an index above the number of frames');
    }
    buffer.set(frameBuffer, frameSize * frameIndex);
    // update geometry
    this.appendFrame();
  };

  /**
   * Append a frame to the image.
   */
  this.appendFrame = function () {
    geometry.appendFrame();
    fireEvent({type: 'appendframe'});
    // memory will be updated at the first appendSlice or appendFrameBuffer
  };

  /**
   * Get the data range.
   *
   * @returns {object} The data range.
   */
  this.getDataRange = function () {
    if (!dataRange) {
      dataRange = this.calculateDataRange();
    }
    return dataRange;
  };

  /**
   * Get the rescaled data range.
   *
   * @returns {object} The rescaled data range.
   */
  this.getRescaledDataRange = function () {
    if (!rescaledDataRange) {
      rescaledDataRange = this.calculateRescaledDataRange();
    }
    return rescaledDataRange;
  };

  /**
   * Get the histogram.
   *
   * @returns {Array} The histogram.
   */
  this.getHistogram = function () {
    if (!histogram) {
      var res = this.calculateHistogram();
      dataRange = res.dataRange;
      rescaledDataRange = res.rescaledDataRange;
      histogram = res.histogram;
    }
    return histogram;
  };

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type, will be called with the fired event.
   */
  this.addEventListener = function (type, callback) {
    listenerHandler.add(type, callback);
  };

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type.
   */
  this.removeEventListener = function (type, callback) {
    listenerHandler.remove(type, callback);
  };

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   * @private
   */
  function fireEvent(event) {
    listenerHandler.fireEvent(event);
  }
};

/**
 * Get the value of the image at a specific coordinate.
 *
 * @param {number} i The X index.
 * @param {number} j The Y index.
 * @param {number} k The Z index.
 * @param {number} f The frame number.
 * @returns {number} The value at the desired position.
 * Warning: No size check...
 */
dwv.image.Image.prototype.getValue = function (i, j, k, f) {
  var frame = (f || 0);
  var index = new dwv.math.Index([i, j, k, frame]);
  return this.getValueAtOffset(
    this.getGeometry().getSize().indexToOffset(index));
};

/**
 * Get the value of the image at a specific index.
 *
 * @param {dwv.math.Index} index The index.
 * @returns {number} The value at the desired position.
 * Warning: No size check...
 */
dwv.image.Image.prototype.getValueAtIndex = function (index) {
  return this.getValueAtOffset(
    this.getGeometry().getSize().indexToOffset(index));
};

/**
 * Get the rescaled value of the image at a specific position.
 *
 * @param {number} i The X index.
 * @param {number} j The Y index.
 * @param {number} k The Z index.
 * @param {number} f The frame number.
 * @returns {number} The rescaled value at the desired position.
 * Warning: No size check...
 */
dwv.image.Image.prototype.getRescaledValue = function (i, j, k, f) {
  if (typeof f === 'undefined') {
    f = 0;
  }
  var val = this.getValue(i, j, k, f);
  if (!this.isIdentityRSI()) {
    if (this.isConstantRSI()) {
      val = this.getRescaleSlopeAndIntercept().apply(val);
    } else {
      var values = [i, j, k, f];
      var index = new dwv.math.Index(values);
      val = this.getRescaleSlopeAndIntercept(index).apply(val);
    }
  }
  return val;
};

/**
 * Get the rescaled value of the image at a specific index.
 *
 * @param {dwv.math.Index} index The index.
 * @returns {number} The rescaled value at the desired position.
 * Warning: No size check...
 */
dwv.image.Image.prototype.getRescaledValueAtIndex = function (index) {
  return this.getRescaledValueAtOffset(
    this.getGeometry().getSize().indexToOffset(index)
  );
};

/**
 * Get the rescaled value of the image at a specific offset.
 *
 * @param {number} offset The desired offset.
 * @returns {number} The rescaled value at the desired offset.
 * Warning: No size check...
 */
dwv.image.Image.prototype.getRescaledValueAtOffset = function (offset) {
  var val = this.getValueAtOffset(offset);
  if (!this.isIdentityRSI()) {
    if (this.isConstantRSI()) {
      val = this.getRescaleSlopeAndIntercept().apply(val);
    } else {
      var index = this.getGeometry().getSize().offsetToIndex(offset);
      val = this.getRescaleSlopeAndIntercept(index).apply(val);
    }
  }
  return val;
};

/**
 * Calculate the data range of the image.
 * WARNING: for speed reasons, only calculated on the first frame...
 *
 * @returns {object} The range {min, max}.
 */
dwv.image.Image.prototype.calculateDataRange = function () {
  var min = this.getValueAtOffset(0);
  var max = min;
  var value = 0;
  var size = this.getGeometry().getSize();
  var leni = size.getTotalSize();
  // max to 3D
  if (size.length() >= 3) {
    leni = size.getDimSize(3);
  }
  for (var i = 0; i < leni; ++i) {
    value = this.getValueAtOffset(i);
    if (value > max) {
      max = value;
    }
    if (value < min) {
      min = value;
    }
  }
  // return
  return {min: min, max: max};
};

/**
 * Calculate the rescaled data range of the image.
 * WARNING: for speed reasons, only calculated on the first frame...
 *
 * @returns {object} The range {min, max}.
 */
dwv.image.Image.prototype.calculateRescaledDataRange = function () {
  if (this.isIdentityRSI()) {
    return this.getDataRange();
  } else if (this.isConstantRSI()) {
    var range = this.getDataRange();
    var resmin = this.getRescaleSlopeAndIntercept().apply(range.min);
    var resmax = this.getRescaleSlopeAndIntercept().apply(range.max);
    return {
      min: ((resmin < resmax) ? resmin : resmax),
      max: ((resmin > resmax) ? resmin : resmax)
    };
  } else {
    var rmin = this.getRescaledValueAtOffset(0);
    var rmax = rmin;
    var rvalue = 0;
    var size = this.getGeometry().getSize();
    var leni = size.getTotalSize();
    // max to 3D
    if (size.length() === 3) {
      leni = size.getDimSize(3);
    }
    for (var i = 0; i < leni; ++i) {
      rvalue = this.getRescaledValueAtOffset(i);
      if (rvalue > rmax) {
        rmax = rvalue;
      }
      if (rvalue < rmin) {
        rmin = rvalue;
      }
    }
    // return
    return {min: rmin, max: rmax};
  }
};

/**
 * Calculate the histogram of the image.
 *
 * @returns {object} The histogram, data range and rescaled data range.
 */
dwv.image.Image.prototype.calculateHistogram = function () {
  var size = this.getGeometry().getSize();
  var histo = [];
  var min = this.getValueAtOffset(0);
  var max = min;
  var value = 0;
  var rmin = this.getRescaledValueAtOffset(0);
  var rmax = rmin;
  var rvalue = 0;
  for (var i = 0, leni = size.getTotalSize(); i < leni; ++i) {
    value = this.getValueAtOffset(i);
    if (value > max) {
      max = value;
    }
    if (value < min) {
      min = value;
    }
    rvalue = this.getRescaledValueAtOffset(i);
    if (rvalue > rmax) {
      rmax = rvalue;
    }
    if (rvalue < rmin) {
      rmin = rvalue;
    }
    histo[rvalue] = (histo[rvalue] || 0) + 1;
  }
  // set data range
  var dataRange = {min: min, max: max};
  var rescaledDataRange = {min: rmin, max: rmax};
  // generate data for plotting
  var histogram = [];
  for (var b = rmin; b <= rmax; ++b) {
    histogram.push([b, (histo[b] || 0)]);
  }
  // return
  return {
    dataRange: dataRange,
    rescaledDataRange: rescaledDataRange,
    histogram: histogram
  };
};

/**
 * Convolute the image with a given 2D kernel.
 *
 * Note: Uses raw buffer values.
 *
 * @param {Array} weights The weights of the 2D kernel as a 3x3 matrix.
 * @returns {Image} The convoluted image.
 */
dwv.image.Image.prototype.convolute2D = function (weights) {
  if (weights.length !== 9) {
    throw new Error(
      'The convolution matrix does not have a length of 9; it has ' +
      weights.length);
  }

  var newImage = this.clone();
  var newBuffer = newImage.getBuffer();

  var imgSize = this.getGeometry().getSize();
  var dimOffset = imgSize.getDimSize(2) * this.getNumberOfComponents();
  for (var k = 0; k < imgSize.get(2); ++k) {
    this.convoluteBuffer(weights, newBuffer, k * dimOffset);
  }

  return newImage;
};

/**
 * Convolute an image buffer with a given 2D kernel.
 *
 * Note: Uses raw buffer values.
 *
 * @param {Array} weights The weights of the 2D kernel as a 3x3 matrix.
 * @param {Array} buffer The buffer to convolute.
 * @param {number} startOffset The index to start at.
 */
dwv.image.Image.prototype.convoluteBuffer = function (
  weights, buffer, startOffset) {
  var imgSize = this.getGeometry().getSize();
  var ncols = imgSize.get(0);
  var nrows = imgSize.get(1);
  var ncomp = this.getNumberOfComponents();

  // number of component and planar configuration vars
  var factor = 1;
  var componentOffset = 1;
  if (ncomp === 3) {
    if (this.getPlanarConfiguration() === 0) {
      factor = 3;
    } else {
      componentOffset = imgSize.getDimSize(2);
    }
  }

  // allow special indent for matrices
  /*jshint indent:false */

  // default weight offset matrix
  var wOff = [];
  wOff[0] = (-ncols - 1) * factor;
  wOff[1] = (-ncols) * factor;
  wOff[2] = (-ncols + 1) * factor;
  wOff[3] = -factor;
  wOff[4] = 0;
  wOff[5] = 1 * factor;
  wOff[6] = (ncols - 1) * factor;
  wOff[7] = (ncols) * factor;
  wOff[8] = (ncols + 1) * factor;

  // border weight offset matrices
  // borders are extended (see http://en.wikipedia.org/wiki/Kernel_%28image_processing%29)

  // i=0, j=0
  var wOff00 = [];
  wOff00[0] = wOff[4]; wOff00[1] = wOff[4]; wOff00[2] = wOff[5];
  wOff00[3] = wOff[4]; wOff00[4] = wOff[4]; wOff00[5] = wOff[5];
  wOff00[6] = wOff[7]; wOff00[7] = wOff[7]; wOff00[8] = wOff[8];
  // i=0, j=*
  var wOff0x = [];
  wOff0x[0] = wOff[1]; wOff0x[1] = wOff[1]; wOff0x[2] = wOff[2];
  wOff0x[3] = wOff[4]; wOff0x[4] = wOff[4]; wOff0x[5] = wOff[5];
  wOff0x[6] = wOff[7]; wOff0x[7] = wOff[7]; wOff0x[8] = wOff[8];
  // i=0, j=nrows
  var wOff0n = [];
  wOff0n[0] = wOff[1]; wOff0n[1] = wOff[1]; wOff0n[2] = wOff[2];
  wOff0n[3] = wOff[4]; wOff0n[4] = wOff[4]; wOff0n[5] = wOff[5];
  wOff0n[6] = wOff[4]; wOff0n[7] = wOff[4]; wOff0n[8] = wOff[5];

  // i=*, j=0
  var wOffx0 = [];
  wOffx0[0] = wOff[3]; wOffx0[1] = wOff[4]; wOffx0[2] = wOff[5];
  wOffx0[3] = wOff[3]; wOffx0[4] = wOff[4]; wOffx0[5] = wOff[5];
  wOffx0[6] = wOff[6]; wOffx0[7] = wOff[7]; wOffx0[8] = wOff[8];
  // i=*, j=* -> wOff
  // i=*, j=nrows
  var wOffxn = [];
  wOffxn[0] = wOff[0]; wOffxn[1] = wOff[1]; wOffxn[2] = wOff[2];
  wOffxn[3] = wOff[3]; wOffxn[4] = wOff[4]; wOffxn[5] = wOff[5];
  wOffxn[6] = wOff[3]; wOffxn[7] = wOff[4]; wOffxn[8] = wOff[5];

  // i=ncols, j=0
  var wOffn0 = [];
  wOffn0[0] = wOff[3]; wOffn0[1] = wOff[4]; wOffn0[2] = wOff[4];
  wOffn0[3] = wOff[3]; wOffn0[4] = wOff[4]; wOffn0[5] = wOff[4];
  wOffn0[6] = wOff[6]; wOffn0[7] = wOff[7]; wOffn0[8] = wOff[7];
  // i=ncols, j=*
  var wOffnx = [];
  wOffnx[0] = wOff[0]; wOffnx[1] = wOff[1]; wOffnx[2] = wOff[1];
  wOffnx[3] = wOff[3]; wOffnx[4] = wOff[4]; wOffnx[5] = wOff[4];
  wOffnx[6] = wOff[6]; wOffnx[7] = wOff[7]; wOffnx[8] = wOff[7];
  // i=ncols, j=nrows
  var wOffnn = [];
  wOffnn[0] = wOff[0]; wOffnn[1] = wOff[1]; wOffnn[2] = wOff[1];
  wOffnn[3] = wOff[3]; wOffnn[4] = wOff[4]; wOffnn[5] = wOff[4];
  wOffnn[6] = wOff[3]; wOffnn[7] = wOff[4]; wOffnn[8] = wOff[4];

  // restore indent for rest of method
  /*jshint indent:4 */

  // loop vars
  var pixelOffset = startOffset;
  var newValue = 0;
  var wOffFinal = [];
  for (var c = 0; c < ncomp; ++c) {
    // component offset
    pixelOffset += c * componentOffset;
    for (var j = 0; j < nrows; ++j) {
      for (var i = 0; i < ncols; ++i) {
        wOffFinal = wOff;
        // special border cases
        if (i === 0 && j === 0) {
          wOffFinal = wOff00;
        } else if (i === 0 && j === (nrows - 1)) {
          wOffFinal = wOff0n;
        } else if (i === (ncols - 1) && j === 0) {
          wOffFinal = wOffn0;
        } else if (i === (ncols - 1) && j === (nrows - 1)) {
          wOffFinal = wOffnn;
        } else if (i === 0 && j !== (nrows - 1) && j !== 0) {
          wOffFinal = wOff0x;
        } else if (i === (ncols - 1) && j !== (nrows - 1) && j !== 0) {
          wOffFinal = wOffnx;
        } else if (i !== 0 && i !== (ncols - 1) && j === 0) {
          wOffFinal = wOffx0;
        } else if (i !== 0 && i !== (ncols - 1) && j === (nrows - 1)) {
          wOffFinal = wOffxn;
        }
        // calculate the weighed sum of the source image pixels that
        // fall under the convolution matrix
        newValue = 0;
        for (var wi = 0; wi < 9; ++wi) {
          newValue += this.getValueAtOffset(
            pixelOffset + wOffFinal[wi]) * weights[wi];
        }
        buffer[pixelOffset] = newValue;
        // increment pixel offset
        pixelOffset += factor;
      }
    }
  }
};

/**
 * Transform an image using a specific operator.
 * WARNING: no size check!
 *
 * @param {Function} operator The operator to use when transforming.
 * @returns {Image} The transformed image.
 * Note: Uses the raw buffer values.
 */
dwv.image.Image.prototype.transform = function (operator) {
  var newImage = this.clone();
  var newBuffer = newImage.getBuffer();
  for (var i = 0, leni = newBuffer.length; i < leni; ++i) {
    newBuffer[i] = operator(newImage.getValueAtOffset(i));
  }
  return newImage;
};

/**
 * Compose this image with another one and using a specific operator.
 * WARNING: no size check!
 *
 * @param {Image} rhs The image to compose with.
 * @param {Function} operator The operator to use when composing.
 * @returns {Image} The composed image.
 * Note: Uses the raw buffer values.
 */
dwv.image.Image.prototype.compose = function (rhs, operator) {
  var newImage = this.clone();
  var newBuffer = newImage.getBuffer();
  for (var i = 0, leni = newBuffer.length; i < leni; ++i) {
    // using the operator on the local buffer, i.e. the
    // latest (not original) data
    newBuffer[i] = Math.floor(
      operator(this.getValueAtOffset(i), rhs.getValueAtOffset(i))
    );
  }
  return newImage;
};
