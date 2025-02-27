This page details which parts of DICOM the DWV supports and also plans to support... This is mainly guided by the demo data that I have, so if you have data that is not supported, please provide me some and I'll try to integrate it.

Main reference: [DICOM/2013](http://dicom.nema.org/dicom/2013/output/chtml/part01/PS3.1.html). The dictionary was generated using [part06/chapter_6](http://dicom.nema.org/dicom/2013/output/chtml/part06/chapter_6.html).

## Validity
All DICOM files should start with the DICOM prefix `DICM` (see [DICOM File Meta Information](http://dicom.nema.org/dicom/2013/output/chtml/part10/chapter_7.html#sect_7.1)). If not, it is not a valid DICOM. Since v0.26 ([#188](https://github.com/ivmartel/dwv/issues/188)), the parser will attempt to parse data without the prefix but there are no guaranty of results!

## Transfer syntax
See the [definition](http://dicom.nema.org/dicom/2013/output/chtml/part05/chapter_10.html) and the UID [list](http://dicom.nema.org/dicom/2013/output/chtml/part06/chapter_A.html#table_A-1).

 * `1.2.840.10008.1.2`: Implicit VR - Little Endian -> &#x2705; *(since v0.2)*
 * `1.2.840.10008.1.2.1`: Explicit VR - Little Endian -> &#x2705; *(since v0.2)*
 * `1.2.840.10008.1.2.1.99`: Deflated Explicit VR - Little Endian -> &#x274C;
 * `1.2.840.10008.1.2.2`: Explicit VR - Big Endian -> &#x2705; *(since v0.2)*
 * `1.2.840.10008.1.2.4.100`: MPEG2 Image Compression -> &#x274C;
 * `1.2.840.10008.1.2.4.5[0,1]`: JPEG -> &#x2705; *(since v0.11, see [#61](https://github.com/ivmartel/dwv/issues/61))*
 * `1.2.840.10008.1.2.4.[57,70]`: JPEG Lossless -> &#x2705; *(since v0.11, see [#165](https://github.com/ivmartel/dwv/issues/165))*
 * `1.2.840.10008.1.2.4.5[others]`: retired JPEG -> &#x274C;
 * `1.2.840.10008.1.2.4.6*`: retired JPEG -> &#x274C;
 * `1.2.840.10008.1.2.4.8*`: JPEG-LS -> &#x274C;
 * `1.2.840.10008.1.2.4.9*`: JPEG 2000 -> &#x2705; *(since v0.5, see [#131](https://github.com/ivmartel/dwv/issues/131))*
 * `1.2.840.10008.1.2.5`: RLE -> &#x2705; *(since v0.26, see [#636](https://github.com/ivmartel/dwv/issues/636))*

## Photometric Interpretation
See the [definition](http://dicom.nema.org/dicom/2013/output/chtml/part03/sect_C.7.html#sect_C.7.6.3.1.2). The planar configuration ([definition](http://dicom.nema.org/dicom/2013/output/chtml/part03/sect_C.7.html#sect_C.7.6.3.1.3)) is used to define the memory layout of colour images.
 * `MONOCHROME1` -> &#x2705; *(since v0.2)*
 * `MONOCHROME2` -> &#x2705; *(since v0.3)*
 * `PALETTE COLOUR` -> &#x2705; *(since v0.27, see [#664](https://github.com/ivmartel/dwv/issues/664))*
 * `RGB` -> &#x2705; *(since v0.3, both planar configuration)*
 * `YBR_FULL` -> &#x274C;
 * `YBR_FULL_422` -> &#x2705; *(since v0.15)*
 * `YBR_PARTIAL_422` -> &#x274C;
 * `YBR_PARTIAL_420` -> &#x274C;
 * `YBR_ICT` -> &#x274C;
 * `YBR_RCT` -> &#x274C;

## Data elements
All Value Representations (VR) should be supported. See the official [list](http://dicom.nema.org/dicom/2013/output/chtml/part05/sect_6.2.html#table_6.2-1).

## Dicom web
Web Access to Dicom persistent Objects (see [DICOMweb](https://en.wikipedia.org/wiki/DICOMweb))

### WADO-RS
-> RESTful Services (RS) (see [Part 3.18 sect 6.5](https://dicom.nema.org/dicom/2013/output/chtml/part18/sect_6.5.html))

WADO-RS is supported via the `MultipartLoader` since <font color="green">v0.31</font>.

The default `Accept` header should be something like: `multipart/related; type="application/dicom"; transfer-syntax=*'`.

### WADO-URI
-> URI based (see [Part 3.18 sect 6.2](https://dicom.nema.org/dicom/2013/output/chtml/part18/sect_6.2.html))

WADO-URI can be provided in the DWV URL using `?input=` since <font color="green">v0.3</font>.

Arguments follow regular URI standard.
 * `requestType`: WADO. **Required**
 * `contentType`: **Required**
   * application/dicom (see transfer syntax above for support)
   * image/jpeg &#x2705; *(since v0.3)*
   * image/gif &#x2705; *(since v0.3)*
   * image/png &#x2705; *(since v0.3)*
   * image/jp2 &#x274C;
 * `studyUID`, `seriesUID`, `objectUID`. **Required**
 * `anonymise`: true or false.
 * If the type is image, then `rows`, `columns`, `windowWidth`, `windowCenter` and more can be specified.

Example:
 * [dicom.vital-it.ch](http://dicom.vital-it.ch) (dead?): [JPEG2000 demo data](http://dicom.vital-it.ch:8089/wado?requestType=WADO&contentType=application/dicom&studyUID=2.16.840.1.113669.632.20.1211.10000744858&seriesUID=1.3.6.1.4.1.19291.2.1.2.2413568109772100001&objectUID=1.3.6.1.4.1.19291.2.1.3.2413568110716100007)
 ```
http://dicom.vital-it.ch:8089/wado?
    requestType=WADO&
    contentType=application/dicom&
    studyUID=2.16.840.1.113669.632.20.1211.10000744858&
    seriesUID=1.3.6.1.4.1.19291.2.1.2.2413568109772100001&
    objectUID=1.3.6.1.4.1.19291.2.1.3.2413568110716100007
```
 * [dicomserver.co.uk](http://www.dicomserver.co.uk): [search](http://www.dicomserver.co.uk/wado/), example [brain data](http://www.dicomserver.co.uk/wado/WADO.asp?requestType=WADO&studyUID=0.0.0.0.2.8811.20010413115754.12432&seriesUID=0.0.0.0.3.8811.2.20010413115754.12432&objectUID=0.0.0.0.1.8811.2.19.20010413115754.12432&contentType=application/dicom) (open in [dwv](http://ivmartel.github.io/dwv/demo/stable/viewers/mobile/index.html?input=http%3a%2f%2fwww.dicomserver.co.uk%2fwado%2fWADO.asp%3frequestType%3dWADO%26studyUID%3d0.0.0.0.2.8811.20010413115754.12432%26seriesUID%3d0.0.0.0.3.8811.2.20010413115754.12432%26objectUID%3d0.0.0.0.1.8811.2.19.20010413115754.12432%26contentType%3dapplication%2fdicom))

## Pixel data
File data storage, either one frame per file or multiple:
 * `Single-frame data`: &#x2705; *(from start!)*
 * `Multi-frame data`: &#x2705; *(since v0.15.0, see [#132](https://github.com/ivmartel/dwv/issues/132))*

## Character sets
 * without code extensions: &#x2705; *(since v0.15.0, see [#248](https://github.com/ivmartel/dwv/issues/248))*
 * with code extensions: &#x274C;

## IOD and Modules
The Part PS 3.3 of the DICOM Standard specifies the set of Information Object Definitions (IODs) which provide an abstract definition of real-world objects applicable to communication of digital medical information. The Attributes of an IOD describe the properties of a Real-World Object Instance. Related Attributes are grouped into [Modules](http://dicom.nema.org/dicom/2013/output/chtml/part03/chapter_C.html) which represent a higher level of semantics documented in the Module Specifications found in Annex C of the DICOM Standard.

An overview of modules for each IOD is defined in [sect_A.1.4](https://dicom.nema.org/dicom/2013/output/chtml/part03/chapter_A.html#sect_A.1.4) (legend: [sect_A.1.3](https://dicom.nema.org/dicom/2013/output/chtml/part03/chapter_A.html#sect_A.1.3)).

Some IODs:
 * [CT](https://dicom.nema.org/dicom/2013/output/chtml/part03/sect_A.3.html)
 * [MR](https://dicom.nema.org/dicom/2013/output/chtml/part03/sect_A.4.html)
 * [RT Image](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.17.3.html)
 * [PET](https://dicom.nema.org/dicom/2013/output/chtml/part03/sect_A.21.html)
 * [Segmentation](https://dicom.nema.org/dicom/2013/output/chtml/part03/sect_A.51.html)
