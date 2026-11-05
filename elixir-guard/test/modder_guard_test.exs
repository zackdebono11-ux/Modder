defmodule ModderGuardTest do
  use ExUnit.Case
  doctest ModderGuard

  test "greets the world" do
    assert ModderGuard.hello() == :world
  end
end
