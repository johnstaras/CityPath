package com.app.citypath

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "CityPathsMobile"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      // fabricEnabled must be true: this app is bridgeless (MainApplication only
      // provides reactHost). With false, ReactActivityDelegate's permission-result
      // path calls getReactNativeHost(), which throws under the New Architecture —
      // crashing on fresh installs when the user answers a permission dialog.
      DefaultReactActivityDelegate(this, mainComponentName, true)
}
