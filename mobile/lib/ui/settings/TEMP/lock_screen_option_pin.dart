import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:photos/theme/ente_theme.dart";
import "package:photos/ui/components/buttons/icon_button_widget.dart";
import "package:photos/ui/settings/TEMP/lock_screen_option_confirm_pin.dart";
import 'package:pinput/pinput.dart';

class LockScreenOptionPin extends StatefulWidget {
  const LockScreenOptionPin({
    super.key,
    this.isAuthenticating = false,
    this.authPin,
  });

  final bool isAuthenticating;
  final String? authPin;
  @override
  State<LockScreenOptionPin> createState() => _LockScreenOptionPinState();
}

class _LockScreenOptionPinState extends State<LockScreenOptionPin> {
  final _pinController = TextEditingController(text: null);

  @override
  void dispose() {
    super.dispose();
    _pinController.dispose();
  }

  void _onKeyTap(String number) {
    _pinController.text += number;
    return;
  }

  void _onBackspace() {
    if (_pinController.text.isNotEmpty) {
      _pinController.text =
          _pinController.text.substring(0, _pinController.text.length - 1);
    }
    return;
  }

  Future<bool> confirmPinAuth(String code) async {
    if (widget.authPin == code) {
      Navigator.of(context).pop(true);
      return true;
    }
    _pinController.clear();
    await HapticFeedback.vibrate();
    return false;
  }

  Future<void> _confirmPin(String code) async {
    if (widget.isAuthenticating) {
      await confirmPinAuth(code);
      return;
    } else {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (BuildContext context) =>
              LockScreenOptionConfirmPin(pin: code),
        ),
      );
      _pinController.clear();
    }
  }

  final _pinPutDecoration = PinTheme(
    height: 48,
    width: 48,
    decoration: BoxDecoration(
      border: Border.all(color: const Color.fromRGBO(45, 194, 98, 1.0)),
      borderRadius: BorderRadius.circular(15.0),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final colorTheme = getEnteColorScheme(context);
    final textTheme = getEnteTextTheme(context);
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        leading: IconButton(
          onPressed: () {
            Navigator.of(context).pop(false);
          },
          icon: Icon(
            Icons.arrow_back,
            color: colorTheme.tabIcon,
          ),
        ),
      ),
      body: Center(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          // mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              height: 60,
            ),
            SizedBox(
              height: 120,
              width: 120,
              child: Stack(
                children: [
                  Align(
                    alignment: Alignment.center,
                    child: SizedBox(
                      height: 75,
                      width: 75,
                      child: ValueListenableBuilder(
                        valueListenable: _pinController,
                        builder: (context, value, child) {
                          return TweenAnimationBuilder<double>(
                            tween: Tween<double>(
                              begin: 0,
                              end: _pinController.text.length / 4,
                            ),
                            curve: Curves.ease,
                            duration: const Duration(milliseconds: 250),
                            builder: (context, value, _) =>
                                CircularProgressIndicator(
                              backgroundColor: colorTheme.fillStrong,
                              value: value,
                              color: colorTheme.primary400,
                              strokeWidth: 1.5,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  Align(
                    alignment: Alignment.center,
                    child: IconButtonWidget(
                      size: 30,
                      icon: Icons.lock,
                      iconButtonType: IconButtonType.primary,
                      iconColor: colorTheme.tabIcon,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              widget.isAuthenticating ? 'Enter PIN' : 'Set new PIN',
              style: textTheme.bodyBold,
            ),
            const Padding(padding: EdgeInsets.all(12)),
            Pinput(
              length: 4,
              useNativeKeyboard: false,
              controller: _pinController,
              defaultPinTheme: _pinPutDecoration,
              submittedPinTheme: _pinPutDecoration.copyWith(
                textStyle: textTheme.h3Bold,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10.0),
                  border: Border.all(
                    color: colorTheme.fillBase,
                  ),
                ),
              ),
              followingPinTheme: _pinPutDecoration.copyWith(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10.0),
                  border: Border.all(
                    color: colorTheme.fillMuted,
                  ),
                ),
              ),
              focusedPinTheme: _pinPutDecoration,
              errorPinTheme: _pinPutDecoration.copyWith(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10.0),
                  border: Border.all(
                    color: colorTheme.fillBase,
                  ),
                ),
                textStyle:
                    textTheme.h3Bold.copyWith(color: colorTheme.warning400),
              ),
              validator: widget.isAuthenticating
                  ? (value) {
                      if (widget.authPin == value) {
                        return null;
                      }
                      return 'Invalid PIN';
                    }
                  : null,
              errorText: '',
              obscureText: true,
              obscuringCharacter: '*',
              onCompleted: (value) async {
                await Future.delayed(const Duration(milliseconds: 250));
                await _confirmPin(_pinController.text);
              },
            ),
            const Spacer(),
            SafeArea(
              child: Container(
                padding: const EdgeInsets.all(2),
                color: colorTheme.strokeFainter,
                child: Column(
                  children: [
                    Row(
                      children: [
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          text: '',
                          number: '1',
                          onTap: () {
                            _onKeyTap('1');
                          },
                        ),
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          text: "ABC",
                          number: '2',
                          onTap: () {
                            _onKeyTap('2');
                          },
                        ),
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          text: "DEF",
                          number: '3',
                          onTap: () {
                            _onKeyTap('3');
                          },
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '4',
                          text: "GHI",
                          onTap: () {
                            _onKeyTap('4');
                          },
                        ),
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '5',
                          text: 'JKL',
                          onTap: () {
                            _onKeyTap('5');
                          },
                        ),
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '6',
                          text: 'MNO',
                          onTap: () {
                            _onKeyTap('6');
                          },
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '7',
                          text: 'PQRS',
                          onTap: () {
                            _onKeyTap('7');
                          },
                        ),
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '8',
                          text: 'TUV',
                          onTap: () {
                            _onKeyTap('8');
                          },
                        ),
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '9',
                          text: 'WXYZ',
                          onTap: () {
                            _onKeyTap('9');
                          },
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '',
                          text: '',
                          muteButton: true,
                        ),
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '0',
                          text: '',
                          onTap: () {
                            _onKeyTap('0');
                          },
                        ),
                        buttonWidget(
                          colorTheme: colorTheme,
                          textTheme: textTheme,
                          number: '',
                          text: '',
                          icons: const Icon(Icons.backspace_outlined),
                          onTap: () {
                            _onBackspace();
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget buttonWidget({
    colorTheme,
    textTheme,
    text,
    number,
    muteButton = false,
    icons,
    onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            shape: BoxShape.rectangle,
            borderRadius: BorderRadius.circular(6),
            color: muteButton
                ? colorTheme.fillFaintPressed
                : icons == null
                    ? colorTheme.backgroundElevated2
                    : null,
          ),
          child: Center(
            child: muteButton
                ? Container()
                : icons != null
                    ? Container(
                        child: icons,
                      )
                    : Container(
                        padding: const EdgeInsets.all(4),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              number,
                              style: textTheme.h3,
                            ),
                            Text(
                              text,
                              style: textTheme.miniBold,
                            ),
                          ],
                        ),
                      ),
          ),
        ),
      ),
    );
  }
}
