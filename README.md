# react-simple-radio-button

## Installation 

`npm install react-simple-radio-button --save`

## Features

- React RadioButton
- You can create radio group with n number of options
- You can pass options as array
- Set a default value
- Get the selected value as string
- Customized UI
- Can override the styles

## Usage

```js
<ReactRadioGroup 
    options={'Option 1', 'Option 2', 'Option 3'}
    defaultSelected='Option 2'/>
```

# Props

### `<ReactSingleDropdown>`
Name | Type | Default | Description
-----|------|---------|------------
options | array | [] | Specify the select(Dropdown) component options as an array of values. For example ['option 1', 'options 2', option 3']
defaultSelected | string | null | Specify one option from the options array as default selected option if required.
onChange | function | selected value | This is a call-back function which returns the selected value back on `onChange`.

## Example
```js
import React from 'react'

import ReactRadioGroup from 'react-simple-radio-button'

export default class Demo extends React.Component {

  onOptionSelect = (value) => {
    console.log('Selected value=', value)
  }
  
  render() {
    return <div>
      <h1>react-simple-radio-button Demo</h1>
      <ReactRadioGroup 
      defaultSelected = 'Option 3'
      onChange={this.onOptionSelect}
      options={['Option 1','Option 2','Option 3']} />
    </div>
  }
}
```

## License

MIT
