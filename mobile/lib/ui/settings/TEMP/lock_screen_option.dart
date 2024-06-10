import "package:flutter/material.dart";
import "package:photos/core/configuration.dart";
import "package:photos/generated/l10n.dart";
import "package:photos/services/local_authentication_service.dart";
import "package:photos/theme/ente_theme.dart";
import "package:photos/ui/components/captioned_text_widget.dart";
import "package:photos/ui/components/divider_widget.dart";
import "package:photos/ui/components/menu_item_widget/menu_item_widget.dart";
import "package:photos/ui/components/title_bar_title_widget.dart";
import "package:photos/ui/components/title_bar_widget.dart";
import "package:photos/ui/components/toggle_switch_widget.dart";
import "package:photos/ui/settings/TEMP/lock_screen_option_password.dart";
import "package:photos/ui/settings/TEMP/lock_screen_option_pin.dart";

class LockScreenOption extends StatefulWidget {
  const LockScreenOption({super.key});

  @override
  State<LockScreenOption> createState() => _LockScreenOptionState();
}

class _LockScreenOptionState extends State<LockScreenOption> {
  final Configuration _configuration = Configuration.instance;
  bool? appLock;
  bool isPinEnabled = false;
  bool isPasswordEnabled = false;

  @override
  void initState() {
    isPasswordEnabled = _configuration.isPasswordSet();
    isPinEnabled = _configuration.isPinSet();
    appLock = isPinEnabled || isPasswordEnabled;
    super.initState();
  }

  Future<void> _deviceLock() async {
    await _configuration.removePinAndPassword();
    setState(() {
      isPasswordEnabled = _configuration.isPasswordSet();
      isPinEnabled = _configuration.isPinSet();
    });
  }

  Future<void> _pinLock() async {
    final bool result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (BuildContext context) {
          return const LockScreenOptionPin();
        },
      ),
    );
    setState(() {
      isPasswordEnabled = _configuration.isPasswordSet();
      isPinEnabled = _configuration.isPinSet();
      if (result == false) {
        appLock = appLock;
      } else {
        appLock = isPinEnabled || isPasswordEnabled;
      }
    });
  }

  Future<void> _passwordLock() async {
    final bool result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (BuildContext context) {
          return const LockScreenOptionPassword();
        },
      ),
    );
    setState(() {
      isPasswordEnabled = _configuration.isPasswordSet();
      isPinEnabled = _configuration.isPinSet();
      if (result == false) {
        appLock = appLock;
      } else {
        appLock = isPinEnabled || isPasswordEnabled;
      }
    });
  }

  Future<void> _onToggleSwitch() async {
    bool result;
    if ((isPinEnabled || isPasswordEnabled) && appLock == true) {
      result = await LocalAuthenticationService.instance
          .requestEnteAuthForLockScreen(context);
      await _configuration.removePinAndPassword();
      isPasswordEnabled = _configuration.isPasswordSet();
      isPinEnabled = _configuration.isPinSet();
    } else {
      result = await LocalAuthenticationService.instance
          .requestLocalAuthForLockScreen(
        context,
        !_configuration.shouldShowLockScreen(),
        S.of(context).authToChangeLockscreenSetting,
        S.of(context).lockScreenEnablePreSteps,
      );
      await _configuration.removePinAndPassword();
      isPasswordEnabled = _configuration.isPasswordSet();
      isPinEnabled = _configuration.isPinSet();
    }
    setState(() {
      if (result) {
        appLock = !appLock!;
      } else {
        appLock = appLock;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colorTheme = getEnteColorScheme(context);
    final textTheme = getEnteTextTheme(context);
    return Scaffold(
      body: CustomScrollView(
        primary: false,
        slivers: <Widget>[
          const TitleBarWidget(
            flexibleSpaceTitle: TitleBarTitleWidget(
              title: 'App lock',
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Column(
                          children: [
                            MenuItemWidget(
                              captionedTextWidget: const CaptionedTextWidget(
                                title: 'App lock',
                              ),
                              alignCaptionedTextToLeft: true,
                              isTopBorderRadiusRemoved: false,
                              isBottomBorderRadiusRemoved: false,
                              menuItemColor: colorTheme.fillFaint,
                              trailingWidget: ToggleSwitchWidget(
                                value: () => appLock!,
                                onChanged: () => _onToggleSwitch(),
                              ),
                            ),
                            const Padding(
                              padding: EdgeInsets.only(top: 16),
                            ),
                            appLock!
                                ? Container()
                                : Text(
                                    'Choose between your device\'s default lock screen and a custom lock screen with a PIN or password.',
                                    style: textTheme.smallFaint,
                                    textAlign: TextAlign.center,
                                  ),
                          ],
                        ),
                        appLock!
                            ? Column(
                                children: [
                                  const SizedBox(
                                    height: 24,
                                  ),
                                  MenuItemWidget(
                                    captionedTextWidget:
                                        const CaptionedTextWidget(
                                      title: 'Device Lock',
                                    ),
                                    alignCaptionedTextToLeft: true,
                                    isTopBorderRadiusRemoved: false,
                                    isBottomBorderRadiusRemoved: true,
                                    menuItemColor: colorTheme.fillFaint,
                                    trailingIcon:
                                        !(isPasswordEnabled || isPinEnabled)
                                            ? Icons.check
                                            : null,
                                    trailingIconColor: colorTheme.tabIcon,
                                    onTap: () => _deviceLock(),
                                  ),
                                  DividerWidget(
                                    dividerType: DividerType.menuNoIcon,
                                    bgColor: colorTheme.fillFaint,
                                  ),
                                  MenuItemWidget(
                                    captionedTextWidget:
                                        const CaptionedTextWidget(
                                      title: 'PIN lock',
                                    ),
                                    alignCaptionedTextToLeft: true,
                                    isTopBorderRadiusRemoved: true,
                                    isBottomBorderRadiusRemoved: true,
                                    menuItemColor: colorTheme.fillFaint,
                                    trailingIcon:
                                        isPinEnabled ? Icons.check : null,
                                    trailingIconColor: colorTheme.tabIcon,
                                    onTap: () => _pinLock(),
                                  ),
                                  DividerWidget(
                                    dividerType: DividerType.menuNoIcon,
                                    bgColor: colorTheme.fillFaint,
                                  ),
                                  MenuItemWidget(
                                    captionedTextWidget:
                                        const CaptionedTextWidget(
                                      title: 'Password lock',
                                    ),
                                    alignCaptionedTextToLeft: true,
                                    isTopBorderRadiusRemoved: true,
                                    isBottomBorderRadiusRemoved: false,
                                    menuItemColor: colorTheme.fillFaint,
                                    trailingIcon:
                                        isPasswordEnabled ? Icons.check : null,
                                    trailingIconColor: colorTheme.tabIcon,
                                    onTap: () => _passwordLock(),
                                  ),
                                ],
                              )
                            : Container(),
                      ],
                    ),
                  ),
                );
              },
              childCount: 1,
            ),
          ),
        ],
      ),
    );
  }
}
