import 'package:flutter_test/flutter_test.dart';
import 'package:ips_collector/utils.dart';
import 'package:ips_collector/models/sensor_config.dart';

void main() {
  test('logFileName sanitizes the prefix and appends a timestamp', () {
    final name = logFileName('Bldg A/Floor 1');
    expect(name.endsWith('.txt'), isTrue);
    expect(name.contains('/'), isFalse);
    expect(name.contains(' '), isFalse);
  });

  test('fmtDuration formats minutes and seconds', () {
    expect(fmtDuration(const Duration(seconds: 65)), '01:05');
    expect(fmtDuration(const Duration(hours: 1, minutes: 2, seconds: 3)),
        '1:02:03');
  });

  test('every sensor type has a non-empty log tag', () {
    for (final t in SensorType.values) {
      expect(t.tag.isNotEmpty, isTrue);
    }
  });
}
